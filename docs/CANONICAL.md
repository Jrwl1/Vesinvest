# Canonical documentation

**If docs conflict with code or with each other: CODE WINS.** Use this file as the entry point for Cursor and humans.

## Read order (start here)

1. **README.md** — Repo overview, quickstart, env, demo mode.
2. **docs/ARCHITECTURE.md** — Modules, Budgets/Assumptions/Projections, legacy vs VA.
3. **docs/API.md** — Auth, Budgets (CRUD + import), preview-kva/confirm-kva, Assumptions, Projections, error format.
4. **docs/REVENUE_DRIVERS_PERSISTENCE_REPORT.md** — Where tuloajurit are persisted and read; confirm-kva flow.
5. **docs/KVA_IMPORT_DRIVERS_CHECKLIST.md** — KVA payload wiring, post-confirm selection, contract tests.
6. **docs/KVA_IMPORT_ROUTING_FIX.md** — Why “Importera från fil” uses preview-kva + KvaImportPreview (not legacy BudgetImport).
7. **docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md** — Referenced from assets/imports code; identity matching rules.
8. **docs/TESTING.md** — How to run tests (if present).

## Canonical set (current behavior)

| Doc | Purpose |
|-----|---------|
| README.md | Repo setup, env, demo |
| docs/ARCHITECTURE.md | High-level modules and VA vs legacy |
| docs/API.md | All HTTP endpoints including KVA import |
| docs/REVENUE_DRIVERS_PERSISTENCE_REPORT.md | Confirm-kva → tuloajurit persistence and GET :id |
| docs/KVA_IMPORT_DRIVERS_CHECKLIST.md | End-to-end KVA drivers wiring and tests |
| docs/KVA_IMPORT_ROUTING_FIX.md | Frontend routing: main CTA → preview-kva flow |
| docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md | Asset identity (referenced from code) |
| docs/SiteContract/SITE_HANDLING_CONTRACT.md | Site handling (referenced if used) |
| docs/DECISIONS.md | ADRs (when present) |
| docs/TESTING.md | Test commands and coverage |

## Supporting (runbooks / debug, not normative)

| Doc | Purpose |
|-----|---------|
| docs/CANONICAL_REPORT.md | This audit report: assumptions from code, what changed |
| docs/KVA_REGRESSION_DEBUG.md | Debug runbook for KVA regressions |
| docs/PROMPTS.md | Prompt templates (operational) |
| docs/TASKS.md | Task list (operational) |
| docs/DEPLOYMENT.md | Deploy instructions |
| docs/CONTRIBUTING.md | Contribution guidelines |

## Deprecated / historical (do not use as current spec)

| Doc | Reason |
|-----|--------|
| docs/EXCEL_IMPORT_KVA_PERFECT_PLAN.md | Superseded by implemented flow; plan only |
| docs/SANITY_CHECK_KVA_PERFECT_PLAN.md | Sanity check for above plan; historical |
| docs/EXCEL_IMPORT_VA_FULL_PLAN.md | Older VA import plan; not current behavior |
| docs/EXCEL_IMPORT_VA_PIVOT_PLAN.md | Pivot plan; superseded by current KVA flow |
| docs/EXCEL_IMPORT_VA_PLAN.md | Older plan; superseded |
| docs/EXCEL_IMPORT_GUIDE.md | Describes legacy asset import (Import tab, mappings); not KVA budget import |
| docs/KVA_DRIVERS_LOG_STAGES.md | Described TEMP logs that have been removed |
| docs/pivot/VA_BUDGET_PIVOT_PLAN.md | Pivot planning; historical |
| docs/pivot/EXCEL_IMPORT_PHILOSOPHY.md | Philosophy doc; not current spec |
| docs/pivot/WATER_UTILITY_PIVOT_OVERVIEW.md | Overview; superseded by ARCHITECTURE + API |

---

## Current system truth (compact)

### KVA import flow

- **Preview:** `POST /budgets/import/preview-kva` (multipart `file`). No budgetId; budget is created on confirm. Implemented in `BudgetsController.previewKva` → `BudgetsService.previewKva` → `budget-import.service` → `previewKvaWorkbook` (kva-template.adapter). Returns `subtotalLines`, `revenueDrivers`, `availableYears`, warnings.
- **Confirm:** `POST /budgets/import/confirm-kva` with body `{ nimi, vuosi, subtotalLines, revenueDrivers, accountLines? }`. Implemented in `BudgetsController.confirmKva` → `BudgetsService.confirmKvaImport` → `BudgetsRepository.confirmKvaImport` in a single `$transaction`: (1) create Talousarvio, (2) create TalousarvioValisumma from subtotalLines (dedupe by palvelutyyppi|categoryKey; exclude tyyppi `tulos`), (3) create Tuloajuri for each revenueDrivers item with “meaningful” data (any of yksikkohinta, myytyMaara, liittymamaara, perusmaksu > 0), (4) optionally create TalousarvioRivi from accountLines.
- **Display:** GET `/budgets/:id` returns budget with `rivit`, `tuloajurit`, `valisummat`. Frontend: when `rivit.length === 0` and `valisummat.length > 0`, rows are built from valisummat; otherwise from rivit. Valisummat are filtered with `filterValisummatNoKvaTotaltDoubleCount` so that for each (tyyppi, categoryKey), if vesi or jatevesi exists, muu is excluded (no double-count of “KVA totalt”).

### Revenue drivers (extraction and persistence)

- **Extraction (preview):** Unit prices from price table (KVA totalt or Blad1); volume (m³) from **Vatten KVA** and **Avlopp KVA** sheets only, from year-column values; connections from **Anslutningar** sheet only, year-column. Single warning per missing category (prices, volume, connections). See `previewKvaRevenueDrivers` in kva-template.adapter.ts.
- **Persistence:** Only drivers with at least one of yksikkohinta, myytyMaara, liittymamaara, perusmaksu > 0 are persisted. Decimals coerced with `Number()`; perusmaksu/liittymamaara/alvProsentti stored as null when not provided.
- **Tests:** `budgets.repository.spec.ts`: confirmKvaImport creates valisummat + tuloajurit in same transaction; findById returns tuloajurit; partial drivers (e.g. only unit price) persisted. `kva-template.adapter.spec.ts`: fixture 2023 volume/connections, subtotal extraction.

### Valisummat vs rivit display

- **rivit:** TalousarvioRivi (account-level lines). Used when non-empty.
- **valisummat:** TalousarvioValisumma (subtotal-level). Used when rivit are empty and valisummat exist (KVA-imported budget). Before building section totals, valisummat are passed through `filterValisummatNoKvaTotaltDoubleCount`: for each (tyyppi, categoryKey), if any row has palvelutyyppi vesi or jatevesi, rows with palvelutyyppi muu are dropped for that key (avoids double-count with “KVA totalt”).

### Uniqueness and errors

- **Talousarvio:** `@@unique([orgId, vuosi, nimi])`. Duplicate name+year → P2002.
- **TalousarvioValisumma:** `@@unique([talousarvioId, palvelutyyppi, categoryKey])`. Confirm path dedupes by (palvelutyyppi, categoryKey) before createMany.
- **P2002:** Mapped to HTTP 409 Conflict by PrismaExceptionFilter; message indicates “budget with this name and year already exists” (or old migration hint if target is orgId+vuosi only).
- **409 UX:** Frontend (KvaImportPreview) shows conflict message on confirm failure; user can change name/year and retry.
