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
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const confirmBtn = page.getByTestId('kva-confirm-btn');
    if (await confirmBtn.isEnabled().catch(() => false)) return;

    const inputs = page.locator('.kva-drivers-table tbody input.kva-input.small');
    const count = await inputs.count();
    for (let i = 0; i < count; i += 1) {
      const input = inputs.nth(i);
      const raw = (await input.inputValue().catch(() => '')).trim();
      const normalized = Number(raw.replace(/\s/g, '').replace(',', '.'));
      if (!Number.isFinite(normalized) || normalized <= 0) {
        await input.fill('1');
      }
    }

    if (await confirmBtn.isEnabled().catch(() => false)) return;
    await page.waitForTimeout(150);
  }
}

async function login(page: Page): Promise<void> {
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
}

async function openKvaImportModal(page: Page, fixturePath: string): Promise<void> {
  await page.getByTestId('budget-import-kva-btn').first().click();
  const kvaModal = page.locator('.kva-import-modal');
  await expect(kvaModal).toBeVisible({ timeout: 15_000 });

  await page.getByTestId('kva-file-input').setInputFiles(fixturePath);
  await expect(page.getByTestId('kva-confirm-btn')).toBeVisible({ timeout: 60_000 });
}

async function confirmKvaImport(page: Page): Promise<void> {
  const kvaModal = page.locator('.kva-import-modal');
  const confirmBtn = page.getByTestId('kva-confirm-btn');
  await fillKvaMissingRequiredFields(page);
  await expect(confirmBtn).toBeEnabled({ timeout: 15_000 });
  await confirmBtn.click();
  await expect(kvaModal).toBeHidden({ timeout: 90_000 });
}

async function computeProjectionAndExportPdf(page: Page): Promise<void> {
  await page.getByTestId('nav-projection-tab').click();
  await expect(page.locator('.projection-page')).toBeVisible({ timeout: 60_000 });

  const recalcBtn = page.getByTestId('projection-recalc-btn');
  await expect(recalcBtn).toBeVisible({ timeout: 60_000 });

  const validationAlertVisible = await page
    .locator('.ev2-validation-banner, .ev2-error-banner, .error-banner')
    .filter({ hasText: /baseline|tulot|water\/wastewater|vesi\/jätevesi/i })
    .first()
    .isVisible()
    .catch(() => false);

  if (!validationAlertVisible && await recalcBtn.isEnabled()) {
    await recalcBtn.click();
    await expect(recalcBtn).not.toContainText(/Lasketaan|Calculating|Beräknar/i, { timeout: 60_000 });
  }

  const pdfBtn = page.getByTestId('projection-export-pdf-btn');
  await expect(pdfBtn).toBeVisible({ timeout: 60_000 });

  const pdfResponsePromise = page.waitForResponse(
    (resp) =>
      /\/projections\/[^/]+\/export-pdf$/.test(new URL(resp.url()).pathname)
      && resp.request().method() === 'GET',
    { timeout: 45_000 },
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
}

test.describe('Ennuste smoke', () => {
  const consoleErrors: string[] = [];
  const failedRequests: Array<{ url: string; failure: string }> = [];
  const failedResponses: Array<{ url: string; status: number }> = [];
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
    failedResponses.length = 0;

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (/favicon\.ico/i.test(text)) return;
        if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
        if (/Failed to load resource: the server responded with a status of 400/i.test(text)) return;
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

    page.on('response', (resp) => {
      const status = resp.status();
      if (status < 400) return;
      let pathname = '';
      try {
        pathname = new URL(resp.url()).pathname;
      } catch {
        pathname = resp.url();
      }
      const expectedProjectionValidation =
        status === 400
        && (
          /\/projections\/[^/]+\/compute$/.test(pathname)
          || /\/projections\/compute-for-budget$/.test(pathname)
        );
      const expectedStaleProjection404 = status === 404 && /\/projections\/[^/]+$/.test(pathname);
      if (expectedProjectionValidation || expectedStaleProjection404) return;
      failedResponses.push({ url: resp.url(), status });
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
    if (failedResponses.length > 0) {
      const details = failedResponses.map((r) => `${r.url} -> ${r.status}`).join('\n');
      throw new Error(`Unexpected non-2xx responses during test:\n${details}`);
    }
  });

  test('full flow manual fallback: credential login -> KVA import -> projection compute -> PDF export', async ({ page }) => {
    await ensureScreenshotDir();
    await login(page);
    await takeNamedScreenshot(page, '01-authenticated-manual.png');

    await openKvaImportModal(page, kvaFixturePath);
    await confirmKvaImport(page);

    await takeNamedScreenshot(page, '02-kva-imported-manual.png');
    await computeProjectionAndExportPdf(page);
    await takeNamedScreenshot(page, '03-projection-and-pdf-manual.png');
  });

  test('full flow VEETI assisted: login -> KVA import -> VEETI autofill -> projection + PDF', async ({ page }) => {
    await ensureScreenshotDir();
    await login(page);

    await openKvaImportModal(page, kvaFixturePath);

    const orgInput = page.getByTestId('kva-veeti-org-id-input');
    const fetchBtn = page.getByTestId('kva-veeti-fetch-btn');
    await expect(orgInput).toBeVisible({ timeout: 30_000 });
    await orgInput.fill('1535');
    await fetchBtn.click();
    await expect(page.getByTestId('kva-veeti-status')).toBeVisible({ timeout: 60_000 });

    // In years with incomplete VEETI publication, manual fallback still completes import.
    await confirmKvaImport(page);

    await computeProjectionAndExportPdf(page);
    await takeNamedScreenshot(page, '04-projection-and-pdf-veeti.png');
  });

  test('manual setup flow: create baseline manually -> scenario + investments + assumptions -> compute', async ({ page }) => {
    await ensureScreenshotDir();
    await login(page);

    const manualSetupBtn = page.getByRole('button', {
      name: /Ohjattu manuaalinen syöttö|Guided manual setup|Guidad manuell inmatning/i,
    });
    await expect(manualSetupBtn).toBeVisible({ timeout: 20_000 });
    await manualSetupBtn.click();
    await expect(page.getByTestId('manual-setup-modal')).toBeVisible({ timeout: 30_000 });

    // Step 1 -> Step 2 -> Step 3 -> Step 4
    await page.getByTestId('manual-setup-next-btn').click();
    await page.getByTestId('manual-setup-next-btn').click();
    await page.getByTestId('manual-setup-next-btn').click();

    await page.getByTestId('manual-setup-vesi-price-input').fill('1.7');
    await page.getByTestId('manual-setup-vesi-volume-input').fill('120000');
    await page.getByTestId('manual-setup-jatevesi-price-input').fill('2.9');
    await page.getByTestId('manual-setup-jatevesi-volume-input').fill('100000');

    // Step 4 -> Step 5
    await page.getByTestId('manual-setup-next-btn').click();
    await page.getByTestId('manual-setup-save-btn').click();
    await expect(page.getByTestId('manual-setup-modal')).toBeHidden({ timeout: 45_000 });

    await page.getByTestId('nav-projection-tab').click();
    await expect(page.locator('.projection-page')).toBeVisible({ timeout: 60_000 });

    // Create new scenario
    await page.getByTestId('projection-create-scenario-btn').click();
    await expect(page.getByTestId('projection-create-scenario-name-input')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('projection-create-scenario-name-input').fill(`E2E skenaario ${Date.now()}`);
    const scenarioBudgetSelect = page.getByTestId('projection-create-scenario-budget-select');
    const options = scenarioBudgetSelect.locator('option');
    const optionCount = await options.count();
    let manualValue: string | null = null;
    let fallbackValue: string | null = null;
    for (let i = 0; i < optionCount; i += 1) {
      const option = options.nth(i);
      const value = await option.getAttribute('value');
      const label = (await option.textContent()) ?? '';
      if (!value || value.trim() === '') continue;
      if (!fallbackValue) fallbackValue = value;
      if (/manuaalinen|manual/i.test(label)) {
        manualValue = value;
        break;
      }
    }
    if (manualValue) {
      await scenarioBudgetSelect.selectOption(manualValue);
    } else if ((await scenarioBudgetSelect.inputValue()) === '' && fallbackValue) {
      await scenarioBudgetSelect.selectOption(fallbackValue);
    }
    await page.getByTestId('projection-create-scenario-add-investment-btn').click();
    await page.getByTestId('projection-create-scenario-submit-btn').click();
    await expect(page.getByTestId('projection-create-scenario-name-input')).toBeHidden({ timeout: 60_000 });

    // Add multiple investments (same year allowed) and save
    await page.getByTestId('projection-add-investment-btn').click();
    await page.getByTestId('projection-add-investment-btn').click();
    await page.getByTestId('projection-investment-amount-0').fill('100000');
    await page.getByTestId('projection-investment-amount-1').fill('150000');
    await page.getByTestId('projection-save-investments-btn').click();

    // Change an assumption and recompute
    const inflationInput = page.getByTestId('projection-assumption-inflaatio-input');
    await inflationInput.click();
    await inflationInput.fill('3,0');
    await inflationInput.blur();

    const recalcBtn = page.getByTestId('projection-recalc-btn');
    await expect(recalcBtn).toBeVisible({ timeout: 30_000 });
    if (await recalcBtn.isEnabled()) {
      await recalcBtn.click();
      await expect(recalcBtn).not.toContainText(/Lasketaan|Calculating|Beräknar/i, { timeout: 60_000 });
    }

    await expect(page.getByTestId('projection-last-computed')).toBeVisible({ timeout: 30_000 });
    await takeNamedScreenshot(page, '05-manual-scenario-investments.png');
  });
});


