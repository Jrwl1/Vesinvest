# Canonical docs + assumption audit — report

## Canonical list

- **README.md** — Repo overview, quickstart, env, demo; now links to docs/CANONICAL.md.
- **docs/ARCHITECTURE.md** — Modules, VA vs legacy, no code-level changes.
- **docs/API.md** — Auth, Budgets (CRUD + **preview-kva**, **confirm-kva**), Assumptions, Projections, error format (P2002 → 409).
- **docs/REVENUE_DRIVERS_PERSISTENCE_REPORT.md** — Confirm-kva → tuloajurit; GET :id includes tuloajurit/valisummat. Unchanged (already accurate).
- **docs/KVA_IMPORT_DRIVERS_CHECKLIST.md** — Payload wiring, post-confirm selection, contract tests. Unchanged.
- **docs/KVA_IMPORT_ROUTING_FIX.md** — Why main CTA uses preview-kva + KvaImportPreview. Unchanged.
- **docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md** — Referenced from code. Unchanged.
- **docs/SiteContract/SITE_HANDLING_CONTRACT.md** — Referenced if used. Unchanged.
- **docs/DECISIONS.md**, **docs/TESTING.md** — ADRs and test commands when present.

## Deprecated list (with banners)

| Doc | Reason |
|-----|--------|
| docs/EXCEL_IMPORT_KVA_PERFECT_PLAN.md | Plan only; superseded by implemented flow |
| docs/SANITY_CHECK_KVA_PERFECT_PLAN.md | Sanity check for above; historical |
| docs/EXCEL_IMPORT_VA_FULL_PLAN.md | Older VA plan; not current behavior |
| docs/EXCEL_IMPORT_VA_PIVOT_PLAN.md | Pivot plan; superseded by current KVA flow |
| docs/EXCEL_IMPORT_VA_PLAN.md | Older plan; superseded |
| docs/EXCEL_IMPORT_GUIDE.md | Legacy asset import; not KVA budget import |
| docs/KVA_DRIVERS_LOG_STAGES.md | TEMP logs removed; historical |
| docs/pivot/VA_BUDGET_PIVOT_PLAN.md | Pivot planning; historical |
| docs/pivot/EXCEL_IMPORT_PHILOSOPHY.md | Philosophy; not current spec |
| docs/pivot/WATER_UTILITY_PIVOT_OVERVIEW.md | Superseded by ARCHITECTURE + API |

## Key assumptions extracted from code (with file refs)

- **KVA preview endpoint:** `POST /budgets/import/preview-kva` — `BudgetsController.previewKva` (budgets.controller.ts ~96–113); `BudgetsService.previewKva` → budget-import.service → `previewKvaWorkbook` (kva-template.adapter.ts 1230+). Returns subtotalLines, revenueDrivers, availableYears.
- **KVA confirm endpoint:** `POST /budgets/import/confirm-kva` — body `{ nimi, vuosi, subtotalLines, revenueDrivers, accountLines? }`. Controller (120–151) → service.confirmKvaImport → repo.confirmKvaImport (budgets.repository.ts 262–369). Single `$transaction`: create Talousarvio; create TalousarvioValisumma (dedupe by palvelutyyppi|categoryKey; exclude tyyppi `tulos` — repo 302); create Tuloajuri for each driver with “meaningful” (any of yksikkohinta, myytyMaara, liittymamaara, perusmaksu > 0) — repo 334–354; optional TalousarvioRivi from accountLines.
- **Subtotal extraction:** `extractSubtotalLines` (kva-template.adapter.ts 679+). Sheets: KVA totalt, Vatten KVA, Avlopp KVA. Year-column only; categories via matchSubtotalCategory (sales_revenue, personnel_costs, etc.); excluded by SUBTOTAL_EXCLUDE; amount from year column.
- **Revenue drivers extraction:** `previewKvaRevenueDrivers` (kva-template.adapter.ts 849+). Volume from Vatten KVA / Avlopp KVA only (year column); connections from Anslutningar only (year column); single warning per missing category. Price table from KVA totalt or Blad1.
- **Valisummat persistence:** Unique key (talousarvioId, palvelutyyppi, categoryKey) — schema.prisma 398. Repo dedupes before createMany (305–316).
- **Budget display:** findById includes rivit, tuloajurit, valisummat (repository 21–30). BudgetPage (344–352): lines = rivit; valisummat filtered by filterValisummatNoKvaTotaltDoubleCount; useValisummaAsRows = lines.length === 0 && valisummat.length > 0; section rows from valisummat when useValisummaAsRows.
- **Double-count filter:** budgetValisummatFilter.ts — for each (tyyppi, categoryKey), if vesi or jatevesi exists, drop muu.
- **Uniqueness:** Talousarvio @@unique([orgId, vuosi, nimi]) — schema 360. TalousarvioValisumma @@unique([talousarvioId, palvelutyyppi, categoryKey]) — schema 398.
- **P2002:** PrismaExceptionFilter (prisma-exception.filter.ts 37–56) → 409 Conflict; message for budget duplicate: “A budget with this name and year already exists”.

## What changed and why

- **Created docs/CANONICAL.md** — Single entry point: read order, canonical/deprecated/supporting sets, “CODE WINS”, compact system truth (KVA flow, drivers, valisummat vs rivit, uniqueness, 409).
- **README.md** — Added one line linking to docs/CANONICAL.md so Cursor/humans find the canonical set.
- **docs/API.md** — Documented `POST /budgets/import/preview-kva` and `POST /budgets/import/confirm-kva` (were missing); clarified error format (P2002 → 409).
- **Deprecation banners** — Added to 10 deprecated/historical docs with pointer to CANONICAL.md and specific canonical replacement where relevant.
- **No changes** to REVENUE_DRIVERS_PERSISTENCE_REPORT, KVA_IMPORT_DRIVERS_CHECKLIST, KVA_IMPORT_ROUTING_FIX, ARCHITECTURE, or contract docs — they already match code.
