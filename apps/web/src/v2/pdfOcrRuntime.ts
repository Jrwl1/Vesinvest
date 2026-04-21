import type { PDFPageProxy } from 'pdfjs-dist';

const TESSERACT_ASSET_BASE = '/vendor/tesseract';
const TESSERACT_WORKER_PATH = `${TESSERACT_ASSET_BASE}/worker.min.js`;
const TESSERACT_CORE_PATH = `${TESSERACT_ASSET_BASE}/core`;
const TESSERACT_LANG_PATH = `${TESSERACT_ASSET_BASE}/lang/`;

let pdfRuntimePromise: Promise<{
  getDocument: typeof import('pdfjs-dist')['getDocument'];
}> | null = null;
let ocrRuntimePromise: Promise<typeof import('tesseract.js')> | null = null;

export async function loadPdfRuntime() {
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

export async function extractPdfPageText(page: PDFPageProxy): Promise<string> {
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

export async function recognizePdfPageWithOcr(params: {
  page: PDFPageProxy;
  languages: string;
  scale: number;
}): Promise<{ text: string; confidence: number | null }> {
  const { page, languages, scale } = params;
  const viewport = page.getViewport({ scale });
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
  const result = await recognize(canvas, languages, {
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
