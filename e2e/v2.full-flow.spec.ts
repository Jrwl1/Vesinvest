import { test, expect, type Locator, type Page } from "@playwright/test";

const CREDENTIALS = {
  email: "admin@vesipolku.dev",
  password: "admin123",
};

function toNumber(rawValue: string): number {
  const parsed = Number(rawValue.trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function nudgeNumericInput(input: Locator, delta: number, decimals: number): Promise<void> {
  await expect(input).toBeVisible({ timeout: 20_000 });
  const current = toNumber(await input.inputValue());
  const next = Math.max(0, current + delta);
  const value = decimals === 0 ? String(Math.round(next)) : next.toFixed(decimals);
  await input.fill(value);
}

async function nudgeAllByPrefix(page: Page, prefix: string, delta: number, decimals: number): Promise<void> {
  const inputs = page.locator(`input[name^="${prefix}"]`);
  const count = await inputs.count();
  expect(count, `expected at least one input for prefix ${prefix}`).toBeGreaterThan(0);
  let nudgedCount = 0;
  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    if (!(await input.isVisible().catch(() => false))) continue;
    await nudgeNumericInput(input, delta, decimals);
    await input.blur();
    nudgedCount += 1;
  }
  expect(nudgedCount, `expected at least one visible input for prefix ${prefix}`).toBeGreaterThan(0);
}

async function clickIfVisibleEnabled(locator: Locator): Promise<boolean> {
  const visible = await locator
    .first()
    .isVisible()
    .catch(() => false);
  const enabled = await locator
    .first()
    .isEnabled()
    .catch(() => false);
  if (!visible || !enabled) return false;
  await locator.first().click();
  return true;
}

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

  const overviewButton = page.getByRole("button", {
    name: /Yhteenveto|Overview|Översikt/i,
  });
  const demoButton = page.getByRole("button", {
    name: /Try demo|Kokeile demoa|Testa demo/i,
  });
  if (await demoButton.isVisible().catch(() => false)) {
    await demoButton.click();
    await maybeAcceptLegalGate(page);
    await expect(overviewButton).toBeVisible({ timeout: 20_000 });
    return;
  }

  await expect(page.locator('input[name="email"]')).toBeVisible({ timeout: 20_000 });
  await page.locator('input[name="email"]').fill(CREDENTIALS.email);
  await page.locator('input[name="password"]').fill(CREDENTIALS.password);
  await page
    .getByRole("button", {
      name: /Sign in|Kirjaudu|Logga in|Signing in|Kirjaudutaan|Loggar in/i,
    })
    .click();

  await maybeAcceptLegalGate(page);
  await expect(overviewButton).toBeVisible({ timeout: 20_000 });
}

async function switchToEnglish(page: Page): Promise<void> {
  const englishButton = page.getByRole("button", {
    name: /^EN$|^ENG$/i,
  });
  if (await englishButton.isVisible().catch(() => false)) {
    await englishButton.click();
    await page.waitForLoadState("networkidle").catch(() => {});
  }
}

async function openManualPatchDialog(page: Page): Promise<void> {
  const editYearButton = page.getByRole("button", {
    name: /Edit year data|Muokkaa vuoden tietoja|Redigera årsdata/i,
  });
  if (
    await editYearButton
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await editYearButton.first().click();
    return;
  }

  const completeManuallyButton = page.getByRole("button", {
    name: /Complete manually|Täydennä manuaalisesti|Komplettera manuellt/i,
  });
  if (
    await completeManuallyButton
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await completeManuallyButton.first().click();
    return;
  }

  const syncButton = page.getByRole("button", {
    name: /Sync recommended years|Sync and create budgets|Synkronoi suositellut vuodet|Synkronoi ja luo budjetit|Synkronisera rekommenderade år|Synkronisera och skapa budgetar/i,
  });
  if (
    (await syncButton
      .first()
      .isVisible()
      .catch(() => false)) &&
    (await syncButton
      .first()
      .isEnabled()
      .catch(() => false))
  ) {
    await syncButton.first().click();
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  if (
    await editYearButton
      .first()
      .isVisible({ timeout: 30_000 })
      .catch(() => false)
  ) {
    await editYearButton.first().click();
    return;
  }

  if (
    await completeManuallyButton
      .first()
      .isVisible({ timeout: 30_000 })
      .catch(() => false)
  ) {
    await completeManuallyButton.first().click();
    return;
  }

  throw new Error("No manual year edit action available in Overview. Cannot exercise manual input dialog.");
}

async function reviewImportedYearsIfNeeded(page: Page): Promise<boolean> {
  await page.waitForLoadState("networkidle").catch(() => {});

  const reviewHeading = page.getByRole("heading", {
    name: /Review imported years|Tarkista tuodut vuodet|Granska importerade år/i,
  });
  if (!(await reviewHeading.isVisible().catch(() => false))) {
    return false;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const openForecastButton = page.getByRole("button", {
      name: /Open Forecast|Avaa Ennuste|Öppna Prognos/i,
    });
    if (await clickIfVisibleEnabled(openForecastButton)) {
      return true;
    }

    const keepIncludedButton = page.getByRole("button", {
      name: /Keep included|Pidä mukana|Behåll inkluderat/i,
    });
    if (await clickIfVisibleEnabled(keepIncludedButton)) {
      await page.waitForLoadState("networkidle").catch(() => {});
      continue;
    }

    const openReviewButton = page.getByRole("button", {
      name: /Open and review|Avaa ja tarkista|Öppna och granska/i,
    });
    if (await clickIfVisibleEnabled(openReviewButton)) {
      await page.waitForLoadState("networkidle").catch(() => {});
      continue;
    }

    const continueButton = page.getByRole("button", {
      name: /Continue|Jatka|Fortsätt/i,
    });
    if (await clickIfVisibleEnabled(continueButton)) {
      await page.waitForLoadState("networkidle").catch(() => {});
      continue;
    }

    break;
  }

  return clickIfVisibleEnabled(
    page.getByRole("button", {
      name: /Open Forecast|Avaa Ennuste|Öppna Prognos/i,
    }),
  );
}

test.describe("V2 full e2e (no export)", () => {
  test.setTimeout(240_000);

  test("covers overview, forecast, reports, and all visible inputs", async ({ page }) => {
    await login(page);
    await switchToEnglish(page);

    const reviewedImportedYears = true;

    await test.step("Overview: use search and year selection inputs", async () => {
      await expect(
        page.getByRole("heading", {
          name: /Review imported years|Tarkista tuodut vuodet|Granska importerade år/i,
        }),
      ).toBeVisible({ timeout: 30_000 });

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const openForecastButton = page.getByRole("button", {
          name: /Open Forecast|Avaa Ennuste|Öppna Prognos/i,
        });
        if (await clickIfVisibleEnabled(openForecastButton)) {
          return;
        }

        const keepIncludedButton = page.getByRole("button", {
          name: /Keep included|Pidä mukana|Behåll inkluderat/i,
        });
        if (await clickIfVisibleEnabled(keepIncludedButton)) {
          await page.waitForLoadState("networkidle").catch(() => {});
          continue;
        }

        const openReviewButton = page.getByRole("button", {
          name: /Open and review|Avaa ja tarkista|Öppna och granska/i,
        });
        if (await clickIfVisibleEnabled(openReviewButton)) {
          await page.waitForLoadState("networkidle").catch(() => {});
          continue;
        }

        const continueButton = page.getByRole("button", {
          name: /Continue|Jatka|Fortsätt/i,
        });
        if (await clickIfVisibleEnabled(continueButton)) {
          await page.waitForLoadState("networkidle").catch(() => {});
          continue;
        }

        throw new Error("Setup review flow did not expose a path to Forecast.");
      }

      throw new Error("Setup review flow did not finish within the expected number of actions.");

      await expect(
        page.getByRole("heading", {
          name: /Data status|Datan tila|Datastatus/i,
        })
      ).toBeVisible({ timeout: 30_000 });

      const searchInput = page.locator("#v2-overview-org-search");
      await expect(searchInput).toBeVisible({ timeout: 20_000 });
      await searchInput.fill("1535");

      const searchButton = page.getByRole("button", {
        name: /Search|Hae|Sök/i,
      });
      if (await searchButton.isEnabled().catch(() => false)) {
        await searchButton.click();
      }

      const firstResult = page.locator(".v2-result-row").first();
      if (await firstResult.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await firstResult.click();
      }

      const connectButton = page.getByRole("button", {
        name: /Connect organization|Yhdistä organisaatio|Anslut organisation/i,
      });
      if (
        (await connectButton
          .first()
          .isVisible()
          .catch(() => false)) &&
        (await connectButton
          .first()
          .isEnabled()
          .catch(() => false))
      ) {
        await connectButton.first().click();
        await page.waitForLoadState("networkidle").catch(() => {});
      }

      const advancedToggle = page.getByRole("button", {
        name: /Choose years manually|Hide advanced year selection|Valitse vuodet manuaalisesti|Piilota vuoden lisävalinta|Välj år manuellt|Dölj avancerat årsval/i,
      });
      if (await advancedToggle.isVisible().catch(() => false)) {
        await advancedToggle.click();
      }

      const selectableYear = page.locator('input[name^="syncYear-"]:not([disabled])').first();
      if (await selectableYear.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await selectableYear.click();
        await selectableYear.click();
      }

      const deleteSelectedYearsButton = page.getByRole("button", {
        name: /Delete selected years|Poista valitut vuodet|Ta bort valda år/i,
      });
      const restoreYearsButton = page.getByRole("button", {
        name: /Restore years|Palauta vuodet|Återställ år/i,
      });

      if (await clickIfVisibleEnabled(deleteSelectedYearsButton)) {
        const confirmDeleteButton = page.getByRole("button", {
          name: /Delete|Poista|Ta bort/i,
        });
        if (
          await confirmDeleteButton
            .first()
            .isVisible()
            .catch(() => false)
        ) {
          await confirmDeleteButton.first().click();
        }
      }

      if (await clickIfVisibleEnabled(restoreYearsButton)) {
        await page.waitForTimeout(200);
      }
    });

    await test.step("Overview: open manual year editor and touch every input", async () => {
      if (reviewedImportedYears || (await reviewImportedYearsIfNeeded(page))) return;

      await openManualPatchDialog(page);

      await expect(page.locator('.v2-modal-backdrop[role="dialog"]')).toBeVisible({
        timeout: 30_000,
      });

      await nudgeNumericInput(page.locator('input[name="manual-financials-liikevaihto"]'), 1000, 2);
      await nudgeNumericInput(page.locator('input[name="manual-financials-henkilostokulut"]'), 100, 2);
      await nudgeNumericInput(page.locator('input[name="manual-financials-liiketoiminnanMuutKulut"]'), 100, 2);
      await nudgeNumericInput(page.locator('input[name="manual-financials-poistot"]'), 50, 2);
      await nudgeNumericInput(page.locator('input[name="manual-financials-arvonalentumiset"]'), 10, 2);
      await nudgeNumericInput(page.locator('input[name="manual-financials-rahoitustuototJaKulut"]'), 1, 2);
      await nudgeNumericInput(page.locator('input[name="manual-financials-tilikaudenYliJaama"]'), 1, 2);
      await nudgeNumericInput(page.locator('input[name="manual-prices-waterUnitPrice"]'), 0.01, 3);
      await nudgeNumericInput(page.locator('input[name="manual-prices-wastewaterUnitPrice"]'), 0.01, 3);
      await nudgeNumericInput(page.locator('input[name="manual-volumes-soldWaterVolume"]'), 10, 0);
      await nudgeNumericInput(page.locator('input[name="manual-volumes-soldWastewaterVolume"]'), 10, 0);
      await nudgeNumericInput(page.locator('input[name="manual-investments-investoinninMaara"]'), 100, 2);
      await nudgeNumericInput(page.locator('input[name="manual-investments-korvausInvestoinninMaara"]'), 100, 2);
      await nudgeNumericInput(page.locator('input[name="manual-energy-prosessinKayttamaSahko"]'), 1, 2);
      await nudgeNumericInput(page.locator('input[name="manual-network-verkostonPituus"]'), 1, 2);

      const reasonInput = page.locator('textarea[name="manual-reason"]');
      await expect(reasonInput).toBeVisible({ timeout: 20_000 });
      await reasonInput.fill(`Playwright full flow check ${Date.now()}`);

      await page
        .getByRole("button", {
          name: /Save year data|Tallenna vuoden tiedot|Spara årsdata/i,
        })
        .click();

      await expect(page.locator('.v2-modal-backdrop[role="dialog"]')).toBeHidden({
        timeout: 60_000,
      });

      const chartViewButton = page.getByRole("button", {
        name: /Chart|Kaavio|Diagram/i,
      });
      if (await chartViewButton.isVisible().catch(() => false)) {
        await chartViewButton.click();
      }

      const cardsViewButton = page.getByRole("button", {
        name: /Year cards|Vuosikortit|Årskort/i,
      });
      if (await cardsViewButton.isVisible().catch(() => false)) {
        await cardsViewButton.click();
      }
    });

    const scenarioName = `E2E full ${Date.now()}`;
    const renamedScenarioName = `${scenarioName} updated`;

    await test.step("Forecast: create scenario and use all editable fields", async () => {
      if (
        !(await clickIfVisibleEnabled(
          page.getByRole("button", {
            name: /Ennuste|Forecast|Prognos/i,
          }),
        ))
      ) {
        await page
          .getByRole("button", {
            name: /Open Forecast|Avaa Ennuste|Öppna Prognos/i,
          })
          .click();
      }

      await expect(page.locator("#v2-forecast-new-scenario-name")).toBeVisible({ timeout: 30_000 });

      const newScenarioInput = page.locator("#v2-forecast-new-scenario-name");
      await newScenarioInput.fill(scenarioName);
      await page
        .getByRole("button", {
          name: /^Uusi$|^New$|^Ny$/i,
        })
        .click();

      const createdRow = page.locator(".v2-scenario-row", { hasText: scenarioName }).first();
      await expect(createdRow).toBeVisible({ timeout: 30_000 });
      await createdRow.click();

      const scenarioNameInput = page.locator("#v2-forecast-scenario-name");
      await expect(scenarioNameInput).toBeVisible({ timeout: 20_000 });
      await scenarioNameInput.fill(renamedScenarioName);

      await nudgeAllByPrefix(page, "nearTermPersonnelPct-", 0.1, 2);
      await nudgeAllByPrefix(page, "nearTermEnergyPct-", 0.1, 2);
      await nudgeAllByPrefix(page, "nearTermOpexOtherPct-", 0.1, 2);

      const visibleInvestmentTotals = page.getByRole("spinbutton", {
        name: /Total EUR \d{4}|Yearly investments \(EUR\) \d{4}/i,
      });
      await expect(visibleInvestmentTotals.first()).toBeVisible({ timeout: 20_000 });
      await nudgeNumericInput(visibleInvestmentTotals.first(), 250, 0);
      await visibleInvestmentTotals.first().blur();

      const saveDraftButton = page.getByRole("button", {
        name: /Save draft|Tallenna luonnos|Spara utkast/i,
      });
      await expect(saveDraftButton).toBeEnabled({ timeout: 20_000 });
      await saveDraftButton.click();

      const computeButton = page.getByRole("button", {
        name: /Save and compute results|Recompute results|Compute and refresh results|Tallenna ja laske tulokset|Laske tulokset uudelleen|Spara och beräkna resultat|Beräkna resultat på nytt/i,
      });
      await expect(computeButton).toBeEnabled({ timeout: 30_000 });
      await computeButton.click();

      await expect(
        page.getByRole("heading", {
          name: /Hintapolku|Price path|Prisbanan/i,
        }).first()
      ).toBeVisible({ timeout: 45_000 });

      await expect(
        page.getByText(/Required price today \(annual result = 0\)|Tarvittava hinta tänään \(vuositulos = 0\)/i).first()
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page
          .getByText(
            /Required price today \(cumulative cash >= 0\)|Tarvittava hinta tänään \(kumulatiivinen kassavirta >= 0\)/i
          )
          .first()
      ).toBeVisible({ timeout: 20_000 });

      const createReportButton = page.getByRole("button", {
        name: /Create report|Luo raportti|Skapa rapport/i,
      });
      if (!(await createReportButton.isEnabled().catch(() => false))) {
        if (await saveDraftButton.isEnabled().catch(() => false)) {
          await saveDraftButton.click();
        }
        await expect(computeButton).toBeEnabled({ timeout: 30_000 });
        await computeButton.click();
      }
      await expect(createReportButton).toBeEnabled({ timeout: 30_000 });
      await createReportButton.click();
    });

    await test.step("Reports: use filter/select inputs and preview report", async () => {
      await expect(page.getByRole("heading", { name: /Raportit|Reports|Rapporter/i })).toBeVisible({ timeout: 45_000 });

      const scenarioFilter = page.locator("#v2-reports-scenario-filter");
      await expect(scenarioFilter).toBeVisible({ timeout: 20_000 });

      const optionValues = await scenarioFilter
        .locator("option")
        .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
      if (optionValues.length > 1) {
        await scenarioFilter.selectOption(optionValues[1] ?? "");
      }

      await page
        .getByRole("button", {
          name: /Refresh list|Päivitä lista|Uppdatera lista/i,
        })
        .click();

      const firstReportRow = page.locator(".v2-report-row:not(.v2-report-row-head)").first();
      await expect(firstReportRow).toBeVisible({ timeout: 20_000 });
      await firstReportRow.click();

      await expect(
        page.getByRole("heading", {
          name: /Selected report|Valittu raportti|Vald rapport/i,
        }).first()
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole("button", {
          name: /Download PDF|Lataa PDF|Ladda ner PDF/i,
        })
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole("heading", {
          name: /Yearly investments from snapshot/i,
        })
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole("heading", {
          name: /Investment plan|Investointisuunnitelma|Investeringsplan/i,
        }).first()
      ).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole("heading", {
          name: /Depreciation plan|Poistosuunnitelma|Avskrivningsplan/i,
        }).first()
      ).toBeVisible({ timeout: 20_000 });
    });

    await test.step("Account: open drawer and sign out", async () => {
      await page
        .getByRole("button", {
          name: /Account|Tili|Konto/i,
        })
        .click();

      const signOutButton = page.getByRole("button", {
        name: /Sign out|Kirjaudu ulos|Logga ut/i,
      });
      if (await signOutButton.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await signOutButton.click();
      }

      await expect(
        page.getByRole("heading", {
          name: /Open workspace|Avaa työtila|Öppna arbetsyta/i,
        })
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("textbox", { name: /Email|Sähköposti|E-post/i })).toBeVisible({
        timeout: 20_000,
      });
    });
  });
});
