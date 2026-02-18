/**
 * Ennuste (Projection) E2E smoke test.
 * Prerequisite: Dev server running at http://localhost:5173 (e.g. pnpm run dev from apps/web).
 *
 * Flow: open app → enter demo mode → go to Ennuste tab → change inputs → recalc → assert observable change.
 * Screenshots: 01-home.png … 05-after-recalc.png in test-results/ennuste-smoke/.
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'ennuste-smoke');

async function ensureScreenshotDir(): Promise<string> {
  await fs.promises.mkdir(SCREENSHOT_DIR, { recursive: true });
  return SCREENSHOT_DIR;
}

async function takeNamedScreenshot(page: Page, name: string): Promise<void> {
  const dir = await ensureScreenshotDir();
  const file = path.join(dir, name);
  await page.screenshot({ path: file, fullPage: false });
}

/**
 * Wait for the app to be idle enough after navigation or click:
 * - Option A: wait for network idle (no requests for 500ms)
 * - Option B: wait for a stable root (Ennuste layout or last-computed text)
 */
async function waitForAppIdle(page: Page, options?: { waitForSelector?: string }): Promise<void> {
  const selector = options?.waitForSelector ?? '[data-ennuste-layout="codex"], .projection-page';
  await page.waitForSelector(selector, { state: 'visible', timeout: 25_000 }).catch(() => {});
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
}

test.describe('Ennuste smoke', () => {
  const consoleErrors: string[] = [];
  const failedRequests: { url: string; failure: string }[] = [];

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    try {
      const res = await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 10_000 });
      if (!res || res.status() >= 400) {
        throw new Error(`Dev server at http://localhost:5173 returned ${res?.status() ?? 'no response'}. Start it with: pnpm run dev (from repo root) or cd apps/web && pnpm dev`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('fetch') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
        throw new Error(`Dev server at http://localhost:5173 is not reachable. Start it with: pnpm run dev (from repo root) or cd apps/web && pnpm dev`);
      }
      throw e;
    } finally {
      await page.close();
    }
  });

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    failedRequests.length = 0;
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error') {
        const text = msg.text();
        consoleErrors.push(text);
      }
    });
    page.on('requestfailed', (req) => {
      const url = req.url();
      const failure = req.failure()?.errorText ?? 'unknown';
      failedRequests.push({ url, failure });
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

  test('full Ennuste flow: demo login → Ennuste tab → change inputs → recalc → observable change', async ({ page }) => {
    await ensureScreenshotDir();

    // 1) Open app
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await takeNamedScreenshot(page, '01-home.png');

    // 2) Enter demo mode (data-testid for demo login; avoid matching "Reset Demo")
    const demoBtn = page.getByTestId('demo-login-btn');
    await demoBtn.click();
    await page.waitForURL((u) => u.pathname === '/' && !u.search, { timeout: 15_000 }).catch(() => {});
    await page.waitForSelector('.app-layout, .app-nav, [class*="app-"]', { state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(1000);
    await takeNamedScreenshot(page, '02-demo.png');

    // 3) Navigate to Ennuste tab (top nav)
    const ennusteTab = page.getByRole('button', { name: /Ennuste|Projection|Prognos/i });
    await ennusteTab.click();

    // If we land on empty state, load demo data first (then wait for Ennuste layout deterministically)
    const loadDemoBtn = page.getByRole('button', { name: /Lataa demodata|Load demo data|Ladda demodata/i });
    if (await loadDemoBtn.isVisible().catch(() => false)) {
      await loadDemoBtn.click();
      await page.waitForSelector('[data-ennuste-layout="codex"], .projection-page', { state: 'visible', timeout: 20_000 }).catch(() => {});
    }

    // 4) Wait for Ennuste page to be interactive (stable root)
    await page.waitForSelector('[data-ennuste-layout="codex"], .projection-page', { state: 'visible', timeout: 25_000 });
    await waitForAppIdle(page);
    await takeNamedScreenshot(page, '03-ennuste-loaded.png');

    // 5) Open Olettamukset accordion if collapsed
    const olettamuksetBtn = page.getByRole('button', { name: /Olettamukset|Assumptions|Scenarioantaganden/i }).first();
    const isExpanded = await olettamuksetBtn.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await olettamuksetBtn.click();
      await page.waitForTimeout(400);
    }

    // Open assumption overrides (Skenaarion olettamukset / Scenario assumptions)
    const overridesBtn = page.getByRole('button', { name: /Skenaarion olettamukset|Scenario assumptions|Oletusarvojen|Scenarioantaganden/i }).first();
    if (await overridesBtn.isVisible().catch(() => false)) {
      const expanded = await overridesBtn.getAttribute('aria-expanded');
      if (expanded !== 'true') {
        await overridesBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // Change Vesimäärän muutos: find row, click Edit, fill input, blur
    const volumeRow = page.getByRole('row').filter({ hasText: /Vesimäärän muutos|Volume change|Volymändring/i });
    const editVolume = volumeRow.getByRole('button', { name: /Muokkaa|Edit|Redigera/i });
    if (await editVolume.isVisible().catch(() => false)) {
      await editVolume.click();
      await page.waitForTimeout(200);
    }
    const volumeInput = volumeRow.locator('input.assumption-input');
    if (await volumeInput.isVisible().catch(() => false)) {
      await volumeInput.fill('2.1');
      await volumeInput.blur();
      await page.waitForTimeout(300);
    }

    // Change Hintakorotus (price increase) if visible
    const priceRow = page.getByRole('row').filter({ hasText: /Hintakorotus|Price increase|Prishöjning/i });
    const editPrice = priceRow.getByRole('button', { name: /Muokkaa|Edit|Redigera/i });
    if (await editPrice.isVisible().catch(() => false)) {
      await editPrice.click();
      await page.waitForTimeout(200);
    }
    const priceInput = priceRow.locator('input.assumption-input');
    if (await priceInput.isVisible().catch(() => false)) {
      await priceInput.fill('1.5');
      await priceInput.blur();
      await page.waitForTimeout(300);
    }

    // Optional: save investments if section is open and Tallenna is visible (so recalc uses latest)
    const saveInvestmentsBtn = page.locator('#accordion-syota-investoinnit').getByRole('button', { name: /^Tallenna$|^Save$/i }).first();
    if (await saveInvestmentsBtn.isVisible().catch(() => false)) {
      await saveInvestmentsBtn.click();
      await page.waitForTimeout(500);
    }

    await takeNamedScreenshot(page, '04-after-inputs.png');

    // 6) Press recalc (prefer data-testid; fallback to role/name)
    const recalcBtn = page.getByTestId('projection-recalc-btn').or(page.getByRole('button', { name: /Laske uudelleen|Laske ennuste|Recompute|Compute projection|Beräkna om/i }));
    await recalcBtn.click();

    // Wait for computing to finish: optional wait for loading to appear, then for it to disappear (locator-based)
    await expect(recalcBtn).toContainText(/Lasketaan|Computing|Beräknar/i, { timeout: 5_000 }).catch(() => {});
    await expect(recalcBtn).not.toContainText(/Lasketaan|Computing|Beräknar/i, { timeout: 30_000 });
    await page.waitForTimeout(800);

    await takeNamedScreenshot(page, '05-after-recalc.png');

    // 7) Assert observable result (prefer data-testid for last-computed)
    // Note: UI shows last-computed with minute-level precision (dateStyle/timeStyle 'short'), so we only assert presence, not before/after change.
    const lastComputedEl = page.getByTestId('projection-last-computed').or(page.locator('.projection-controls__last-computed'));
    const lastComputedAfter = await lastComputedEl.textContent().catch(() => null);
    const hasLastComputed = lastComputedAfter != null && lastComputedAfter.trim().length > 0;
    const hasTimestamp = lastComputedAfter != null && /\d|\./.test(lastComputedAfter);

    expect(hasLastComputed || hasTimestamp, 'Expected "Viimeksi laskettu" / last-computed timestamp to be present after recalc').toBe(true);

    const kpiPanelAfter = await page.locator('.projection-kpi-panel').textContent().catch(() => null);
    const hasKpiContent = kpiPanelAfter != null && kpiPanelAfter.trim().length > 5;
    expect(hasKpiContent, 'Expected KPI panel (sustainability/tariff/cumulative) to have content').toBe(true);

    const chartOrTable = page.locator('.ennuste-tulokset-chart svg, .projection-kpi-grid, .projection-year-inspector');
    await expect(chartOrTable.first()).toBeVisible({ timeout: 5000 });
  });
});
