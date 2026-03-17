const TESSERACT_ASSET_BASE = '/vendor/tesseract';
const TESSERACT_WORKER_PATH = `${TESSERACT_ASSET_BASE}/worker.min.js`;
const TESSERACT_CORE_PATH = `${TESSERACT_ASSET_BASE}/core`;
const TESSERACT_LANG_PATH = `${TESSERACT_ASSET_BASE}/lang/`;

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

const PRICE_PATTERN = /(-?\d[\d\s.,]*)\s*(?:€|eur)?\s*(?:\/|per)?\s*(?:m3|m³)/i;
const VOLUME_PATTERN = /(-?\d[\d\s.,]*)\s*(?:m3|m³)/i;

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
      /(avlopp|spill|wastewater|jatevesi|jätevesi)/i.test(normalized)
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
      !/(avlopp|spill|wastewater|jatevesi|jätevesi)/i.test(normalized)
    ) {
      registerMatch('waterUnitPrice', line, extractNumber(line, PRICE_PATTERN));
      continue;
    }
    if (
      fields.soldWastewaterVolume == null &&
      /(avlopp|spill|wastewater|jatevesi|jätevesi)/i.test(normalized)
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
      !/(avlopp|spill|wastewater|jatevesi|jätevesi)/i.test(normalized)
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
  const { getDocument } = await import('pdfjs-dist');
  const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  const { GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const maxPages = Math.min(pdf.numPages, MAX_SCAN_PAGES);
  let bestCandidate: (ScanCandidate & { pageNumber: number }) | null = null;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    onProgress?.(`Scanning QDIS page ${pageNumber}/${maxPages}...`);
    const page = await pdf.getPage(pageNumber);
    const directText = await extractPageText(page);
    const ocrText = await extractPageTextWithOcr(page);
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

async function extractPageText(page: any): Promise<string> {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item: any) => {
      if ('str' in item) {
        return item.str;
      }
      return '';
    })
    .join('\n');
}

async function extractPageTextWithOcr(
  page: any,
): Promise<{ text: string; confidence: number | null }> {
  const { recognize } = await import('tesseract.js');
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

  const result = await recognize(canvas, 'swe+eng', {
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
