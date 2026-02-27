import { test, expect, Page } from "@playwright/test";

const CREDENTIALS = {
  email: "admin@vesipolku.dev",
  password: "admin123",
};

async function maybeAcceptLegalGate(page: Page): Promise<void> {
  const legalHeading = page.getByRole("heading", {
    name: /Legal acceptance required|Oikeudellinen hyväksyntä vaaditaan|Juridiskt godkännande krävs/i,
  });
  if (!(await legalHeading.isVisible().catch(() => false))) return;

  const checks = page.locator('.legal-check input[type="checkbox"]');
  const checkCount = await checks.count();
  for (let index = 0; index < checkCount; index += 1) {
    await checks.nth(index).check();
  }

  await page
    .getByRole("button", {
      name: /Accept and continue|Hyväksy ja jatka|Acceptera och fortsätt/i,
    })
    .click();
}

async function login(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  const emailInput = page.locator('input[name="email"]');
  const passwordInput = page.locator('input[name="password"]');
  const loginButton = page.getByRole("button", {
    name: /Sign in|Kirjaudu|Logga in|Signing in|Kirjaudutaan|Loggar in/i,
  });

  await expect(emailInput).toBeVisible({ timeout: 20_000 });
  await emailInput.fill(CREDENTIALS.email);

  await passwordInput.fill(CREDENTIALS.password);
  await loginButton.click();
  await maybeAcceptLegalGate(page);

  await expect(
    page.getByRole("button", {
      name: /Yhteenveto|Overview|Översikt/i,
    })
  ).toBeVisible({ timeout: 20_000 });
}

async function ensureForecastComputed(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Ennuste|Forecast|Prognos/i }).click();

  const computeButton = page.getByRole("button", {
    name: /Laske ja päivitä tulokset|Compute and refresh results|Beräkna och uppdatera resultat/i,
  });

  const computeVisible = await computeButton.isVisible({ timeout: 15_000 }).catch(() => false);

  if (!computeVisible) {
    const createButton = page.getByRole("button", { name: /Uusi|New|Ny/i });
    await expect(createButton).toBeVisible({ timeout: 15_000 });
    await createButton.click();
    await expect(computeButton).toBeVisible({ timeout: 30_000 });
  }

  if (await computeButton.isEnabled()) {
    await computeButton.click();
    await expect(computeButton).toBeVisible({ timeout: 45_000 });
  }

  await expect(page.getByRole("heading", { name: /Hintapolku|Price path|Prisbanan/i })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("V2 smoke", () => {
  test("login -> overview -> forecast -> reports", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: /Datan tila|Data status|Datastatus/i })).toBeVisible({
      timeout: 30_000,
    });

    await ensureForecastComputed(page);

    await page.getByRole("button", { name: /Raportit|Reports|Rapporter/i }).click();
    await expect(page.getByRole("heading", { name: /Raportit|Reports|Rapporter/i })).toBeVisible({ timeout: 30_000 });
  });
});
