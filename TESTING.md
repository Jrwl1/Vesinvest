# Testing Guide

This document covers how to run tests in the monorepo.

## Quick Start

```bash
# Run all workspace tests
pnpm -r test

# Run API tests only
pnpm --filter ./apps/api test
```

## API Tests (Jest)

The API (`apps/api`) uses Jest with ts-jest for TypeScript support.

### Basic Commands

```bash
# Run all API tests
pnpm --filter ./apps/api test

# Run from within apps/api directory
cd apps/api
pnpm test
```

### Passing Jest Flags

To pass flags like `--runInBand` (run tests serially), `--watch`, or `--coverage`:

```bash
# Using pnpm exec (recommended for CI/scripts)
pnpm --filter ./apps/api exec jest --runInBand

# Using -- separator
pnpm --filter ./apps/api test -- --runInBand

# Run specific test file
pnpm --filter ./apps/api exec jest src/imports/row-hash.spec.ts

# Watch mode
pnpm --filter ./apps/api exec jest --watch

# With coverage
pnpm --filter ./apps/api exec jest --coverage
```

### Test Files Location

API tests are co-located with source files:
- `apps/api/src/**/*.spec.ts` - Unit tests
- `apps/api/test/**/*.spec.ts` - E2E tests

### Local fixtures (VA import, KVA template)

Some tests (e.g. KVA template adapter) optionally use local Excel fixtures. These files are **gitignored** and must not be committed.

- **Where to place fixtures:** Put Excel/PDF fixtures in `fixtures/va-import/` or `fixtures/` at repo root (see docs/EXCEL_IMPORT_VA_PLAN.md).
- **Run tests with fixtures:** Copy or symlink your fixture (e.g. `Simulering av kommande lönsamhet KVA.xlsx`) into `fixtures/` or set `VA_FIXTURES_DIR` to the directory containing it (relative to repo root or absolute). Example:
  ```bash
  # From repo root; fixtures in fixtures/
  VA_FIXTURES_DIR=fixtures pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  ```
- **When fixtures are missing:** Tests that depend on the KVA fixture **skip** with a clear message instead of failing, so CI without fixtures passes.

### Current Test Suites

| File | Description |
|------|-------------|
| `src/mappings/canonical-registry.spec.ts` | Canonical field registry validation |
| `src/imports/row-hash.spec.ts` | Row hash computation for idempotency |
| `src/imports/column-profiler.spec.ts` | Excel column type inference |

## Manual test: Login and demo (no auto-skip)

Demo starts **only** when the user clicks "Use Demo". Quick checklist:

| Scenario | Expected |
|----------|----------|
| Fresh load, no token (clear localStorage) | Always lands on Sign In screen. |
| Demo enabled (backend) | "Use Demo" visible/enabled after status loads; does nothing until clicked. |
| Click "Use Demo" | Calls POST /auth/demo-login, stores token, routes to app. |
| Backend unreachable | Sign In screen; "Demo mode unavailable" banner; button disabled or "Checking demo...". |
| Valid token in localStorage | Skip Sign In, show app (normal authenticated flow). |
| Token expired / 401 on any request | Token cleared, user must sign in or click Use Demo again (no auto dev-token). |

Verify via Cloudflare tunnel: open tunnel URL in incognito → Sign In first → click Use Demo → app loads.

## Manual test: Manual-first skeleton (empty org)

After resetting demo data (or starting with an empty org), the app must show the full VA layout with 0 defaults, not a blank screen:

| Tab | Expected |
|-----|----------|
| Talousarvio | Full sections (Tulot/Kulut/Investoinnit) with **editable** 0€ rows; "Tuo tiedostosta" (disabled), "Lataa demodata", "Tallenna talousarvio" at top. |
| Tulot | Full revenue driver form (vesi/jätevesi) with 0 defaults; totals update live; "Lataa demodata" and link to Budget. |
| Ennuste | Scaffold with message and table headers; when budgets exist, "Laske ennuste" + "Lataa demodata"; after compute, result table. |
| Asetukset | Assumptions list with default rows (e.g. inflaatio 2.5%) if API returns none; editable, save persists. |

Verify: reset demo → reload → each tab shows structure; "Lataa demodata" populates example data; no white screen or hook order errors.

## Manual test: Talousarvio draft → save flow

Editable-first budget: the Talousarvio tab always shows the full editable table (draft or persisted).

| Step | Expected |
|------|----------|
| 1. Fresh demo org, no budgets | Talousarvio shows editable rows (0€). Type e.g. 12000 into "Liittymismaksut" (3900); totals update live. No navigation; no second empty page. |
| 2. Click "Tallenna talousarvio" | Modal opens: name (required), year (default current). |
| 3. Enter name, click Save | Budget is created; dropdown shows it and it is selected; values match what was typed in draft. |
| 4. "Tuo tiedostosta" | Button visible but disabled; tooltip e.g. "Tulossa myöhemmin". No crash. |
| 5. "Lataa demodata" (draft mode) | Seeds dataset; page switches to persisted budget; data loads. |
| 6. Dropdown "Uusi talousarvio" | Resets to fresh editable draft (0€), same page; no navigate away. |
| 7. Dropdown select existing budget | Switches to that budget (persisted); edits save as before. |

Verify: no React hook order warnings; no white screen; no repeated failing request loops in console.

### Vesimaksut (3000) dependency on Tulot

- Row 3000 shows a **source chip** (e.g. "Lähde: Tulot" / "Source: Revenues"); clicking it goes to Tulot tab and scrolls to revenue drivers.
- With **empty org** (no drivers): row 3000 shows **"—"** and hint "Täytä Tulot" (not "0 €"); expanding the row shows "Missing fields" list and CTA "Täydennä Tulot".
- **Whole row** is clickable to expand/collapse the calculation panel; keyboard Enter/Space toggles; toggle button still works.
- When **drivers are configured**: row shows computed amount (e.g. "12 000 €"); expanded panel shows breakdown table and "Muokkaa Tulot".
- No hook order warnings; typecheck passes.

### Manual test: Import from file

**Cause (why it was disabled):** The "Tuo tiedostosta" button was explicitly `disabled` in draft mode (no budget selected) with tooltip "coming later". The import overlay (BudgetImport) also requires a `budgetId`, so it could not open without an existing budget. Fix: button is now clickable in draft mode; clicking opens a "Create budget for import" modal (name + year); on confirm the budget is created and the import overlay opens for that budget.

- **Empty org** (e.g. after Reset demo): Talousarvio shows structure with 0 values. **"Tuo tiedostosta" / "Import from file"** is **clickable**. Clicking it opens a modal "Create budget for import" (name + year). On confirm, a budget is created and the import overlay opens; user selects .xlsx/.xls file → preview (rows, format, warnings, summary) → Confirm imports rows; table updates and is editable.
- **Existing budget:** With a budget selected, Import opens the overlay directly (no create modal). Preview → Confirm updates the selected budget's rows.
- **Errors:** If preview fails (e.g. invalid file), an error message is shown in the overlay; no white screen.
- **No regressions:** Demo login, manual-first skeleton, and same-origin /api proxy (e.g. Cloudflare tunnel) still work.

## Web Tests

The web app (`apps/web`) does not have tests configured yet. The test script is a no-op placeholder.

To add tests later, install Vitest:
```bash
pnpm --filter ./apps/web add -D vitest @testing-library/react
```

## Release gates and gate failure

Release gates (build, pre-release security, single-tenant readiness) are defined in [DEPLOYMENT.md](../DEPLOYMENT.md). When **required evidence is missing** or a gate command fails (e.g. `pnpm test`):

- **Do not release.** Fix the failing tests or build, or document an approved exception.
- Re-run the failing command from the repository root (e.g. `pnpm test`, or the specific spec listed in the checklist).
- See DEPLOYMENT.md → "Gate failure instructions" for full steps.

## CI/CD

For CI pipelines, run tests with `--runInBand` to avoid parallel execution issues:

```bash
pnpm --filter ./apps/api exec jest --runInBand --ci
```

## Ennuste bootstrap regression checklist

Run this quick manual regression after deployment to staging:

1. Fresh org + imported KVA data opens Ennuste directly to a computed 20-year baseline (no scenario creation click required).
2. Create a scenario with at least one investment and changed water price/volume overrides, then verify summary strip, chart, and table all update for that scenario.
3. Export CSV and PDF for both baseline and the created scenario, and verify files download with computed content.

## Configuration Notes

### ts-jest Version Warning Suppression

The API uses ts-jest 27.x with TypeScript 5.x. ts-jest emits a version compatibility warning because it predates TS 5.x, but it works correctly for our use case. The warning is suppressed via `TS_JEST_DISABLE_VER_CHECKER=1` in `apps/api/jest.config.js`.

See: https://github.com/kulshekhar/ts-jest/issues/4198

## Troubleshooting

### "Cannot use import statement outside a module"
Ensure `jest.config.js` exists in `apps/api` with `preset: 'ts-jest'`.

### Prisma types not found / Asset.ageYears does not exist
After schema changes, run migrate and regenerate the client in `apps/api`:
```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
```
Or from repo root: `pnpm --filter ./apps/api exec prisma migrate dev` then `pnpm --filter ./apps/api exec prisma generate`.

### Tests timing out
Run with `--runInBand` to execute tests serially:
```bash
pnpm --filter ./apps/api exec jest --runInBand
```
