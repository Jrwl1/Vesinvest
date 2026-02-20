import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'ennuste-smoke');
const KVA_FIXTURE = path.join(process.cwd(), 'fixtures', 'Simulering av kommande lonsamhet KVA.xlsx');
const KVA_FIXTURE_UTF8 = path.join(process.cwd(), 'fixtures', 'Simulering av kommande lönsamhet KVA.xlsx');

const CREDENTIALS = {
  email: 'admin@plan20.dev',
  password: 'devpassword',
};

async function ensureScreenshotDir(): Promise<string> {
  await fs.promises.mkdir(SCREENSHOT_DIR, { recursive: true });
  return SCREENSHOT_DIR;
}

async function takeNamedScreenshot(page: Page, name: string): Promise<void> {
  const dir = await ensureScreenshotDir();
  await page.screenshot({ path: path.join(dir, name), fullPage: false });
}

async function resolveFixturePath(): Promise<string> {
  try {
    await fs.promises.access(KVA_FIXTURE_UTF8, fs.constants.R_OK);
    return KVA_FIXTURE_UTF8;
  } catch {
    await fs.promises.access(KVA_FIXTURE, fs.constants.R_OK);
    return KVA_FIXTURE;
  }
}

async function maybeAcceptLegalGate(page: Page): Promise<void> {
  const legalHeading = page.getByRole('heading', { name: /Legal acceptance required/i });
  if (!(await legalHeading.isVisible().catch(() => false))) return;

  const checks = page.locator('.legal-check input[type="checkbox"]');
  const checkCount = await checks.count();
  for (let i = 0; i < checkCount; i += 1) {
    await checks.nth(i).check();
  }
  await page.getByRole('button', { name: /Accept and continue/i }).click();
}

async function fillKvaMissingRequiredFields(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const missingInputs = page.locator('.kva-input.small.input-error');
    if ((await missingInputs.count()) === 0) return;
    await missingInputs.first().fill('1');
  }
}

test.describe('Ennuste smoke', () => {
  const consoleErrors: string[] = [];
  const failedRequests: Array<{ url: string; failure: string }> = [];
  let kvaFixturePath = KVA_FIXTURE_UTF8;

  test.beforeAll(async ({ browser }) => {
    kvaFixturePath = await resolveFixturePath();

    const page = await browser.newPage();
    try {
      const res = await page.goto('http://localhost:5173/', {
        waitUntil: 'domcontentloaded',
        timeout: 10_000,
      });
      if (!res || res.status() >= 400) {
        throw new Error(`Dev server returned ${res?.status() ?? 'no response'}`);
      }
    } finally {
      await page.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    failedRequests.length = 0;

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (/favicon\.ico/i.test(text)) return;
        if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
        consoleErrors.push(text);
      }
    });

    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.startsWith('blob:')) return;
      failedRequests.push({
        url,
        failure: req.failure()?.errorText ?? 'unknown',
      });
    });
  });

  test.afterEach(async () => {
    if (consoleErrors.length > 0) {
      throw new Error(`Console errors during test:\n${consoleErrors.join('\n')}`);
    }
    if (failedRequests.length > 0) {
      const details = failedRequests.map((r) => `${r.url} -> ${r.failure}`).join('\n');
      throw new Error(`Failed network requests during test:\n${details}`);
    }
  });

  test('full flow: credential login -> KVA import -> projection compute -> PDF export', async ({ page }) => {
    await ensureScreenshotDir();

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    await page.getByLabel(/^Email$/i).fill(CREDENTIALS.email);
    await page.getByLabel(/^Password$/i).fill(CREDENTIALS.password);
    await page.getByRole('button', { name: /Sign In|Signing in/i }).click();

    await maybeAcceptLegalGate(page);
    await expect(page.locator('.app-layout')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Talousarvio|Budget/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    await takeNamedScreenshot(page, '01-authenticated.png');

    await page.getByTestId('budget-import-kva-btn').first().click();

    const kvaModal = page.locator('.kva-import-modal');
    await expect(kvaModal).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('kva-file-input').setInputFiles(kvaFixturePath);
    const confirmBtn = page.getByTestId('kva-confirm-btn');
    await expect(confirmBtn).toBeVisible({ timeout: 60_000 });

    await fillKvaMissingRequiredFields(page);
    await expect(page.locator('.kva-input.small.input-error')).toHaveCount(0, { timeout: 15_000 });
    await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
    await takeNamedScreenshot(page, '02-kva-preview-ready.png');

    await confirmBtn.click();
    await expect(kvaModal).toBeHidden({ timeout: 90_000 });
    await takeNamedScreenshot(page, '03-kva-imported.png');

    await page.getByTestId('nav-projection-tab').click();
    await expect(page.locator('.projection-page')).toBeVisible({ timeout: 60_000 });

    const recalcBtn = page.getByTestId('projection-recalc-btn');
    await expect(recalcBtn).toBeVisible({ timeout: 60_000 });

    if (await recalcBtn.isEnabled()) {
      await recalcBtn.click();
      await expect(recalcBtn).not.toContainText(/Lasketaan|Calculating|Beräknar/i, { timeout: 60_000 });
    }

    const pdfBtn = page.getByTestId('projection-export-pdf-btn');
    await expect(pdfBtn).toBeVisible({ timeout: 60_000 });

    const pdfResponsePromise = page.waitForResponse(
      (resp) =>
        /\/projections\/[^/]+\/export-pdf$/.test(new URL(resp.url()).pathname)
        && resp.request().method() === 'GET',
      { timeout: 30_000 },
    );

    await pdfBtn.click();

    const pdfResponse = await pdfResponsePromise;
    const pdfStatus = pdfResponse.status();
    const pdfErrorText = pdfStatus === 200 ? '' : await pdfResponse.text();
    expect(pdfStatus, `PDF export failed: ${pdfErrorText}`).toBe(200);
    expect((await pdfResponse.headerValue('content-type')) ?? '').toContain('application/pdf');
    const contentLength = Number((await pdfResponse.headerValue('content-length')) ?? 0);
    const responseBodyLength = (await pdfResponse.body()).byteLength;
    expect(Math.max(contentLength, responseBodyLength)).toBeGreaterThan(1000);

    await takeNamedScreenshot(page, '04-projection-and-pdf.png');
  });
});
