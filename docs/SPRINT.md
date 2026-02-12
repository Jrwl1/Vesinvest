# Sprint

Window: 2026-02-12 to 2026-05-20

Exactly 5 executable DO items. Execute top-to-bottom.
Each `Do` cell checklist must be flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-substep. Each checked substep must include commit hash + run summary + changed files.
Required substep shape:
- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | status: clean`
Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
`DONE` is set by `REVIEW` only after Acceptance is verified against Evidence.

## Recorded decisions (this sprint)

**Sign convention (Option A):** Store all amounts as positive numbers. Tulos (result) = Tulot - Kulut - Poistot - Investoinnit. (ADR-021.)

**Rows imported from KVA totalt:** Section headers and P&L rows matched by `SUBTOTAL_CATEGORIES`; exclude `SUBTOTAL_EXCLUDE` (e.g. "Förändring i...") and result-type rows; Tulos always derived. Breakdown per (palvelutyyppi, categoryKey, year). (ADR-022.)

**Missing bucket:** If a bucket has no rows for a year, treat as 0.

**Vuosi selector:** No single-year selector; confirm applies to all 3 extracted years; one budget per year.

**Talousarvio tab:** Historical actuals only from KVA import; no tuloajurit on Talousarvio (ADR-022).

**Locked (customer):** (1) **Grouping:** Explicit DB grouping — add `importBatchId` (or equivalent); migration; KVA confirm sets same batch on all 3 budgets; selector chooses "set", page shows 3 year cards. (2) **Card header:** "Vuosi YYYY" + Tulos in header (green/red). (3) **Lägg till rad:** Remove "+ Lägg till rad" for valisummat-only view; read-only. (4) **Confirm button:** FI "Tallenna", SWE "Spara", ENG "Save"; update i18n per language. (5) **Källa:** Show "Källa: Importerad från Excel (filnamn + datum)" per year card; store importSourceFileName + importedAt. (6) **Investoinnit:** Always show bucket; 0 if empty.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Schema + import batch + Källa: add importBatchId (and Källa fields); migration; KVA confirm sets batch on 3 budgets and stores filename+timestamp. See S-01 substeps below. | prisma/schema.prisma, apps/api/prisma/migrations/**, apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budget-import.service.ts | Talousarvio has importBatchId; batch table or fields hold importSourceFileName, importedAt; confirm writes batch id and Källa metadata for all 3 budgets. | 035460f d8841ec e209e20 | Stop if migration cannot be added; log backlog and stop. | READY |
| S-02 | API for budget sets: list sets (distinct batch ids); get 3 budgets by batch id; Talousarvio selector loads set and fetches 3 budgets for year cards. See S-02 substeps below. | apps/api/src/budgets/budgets.controller.ts, apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/budgets.repository.ts, apps/web/src/pages/BudgetPage.tsx, apps/web/src/api.ts | Selector shows budget sets; selecting a set returns 3 budgets (by batch id); page can render 3 year cards from that data. | 5781f09 | Stop if API contract cannot support set-based load; log backlog and stop. | READY |
| S-03 | Talousarvio tab UI: 3 year cards (oldest→newest), 4 buckets (Tulot, Kulut, Poistot, Investoinnit), per-bucket expand, Tulos in header+footer, remove Lägg till rad for valisummat view, Källa per card. See S-03 substeps below. | apps/web/src/pages/BudgetPage.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json | Talousarvio shows 3 cards; 4 buckets; expand shows detail rows summing to bucket total; Tulos by sign; no add-line when valisummat-only; Källa text on each card. | ca2459b | Stop if layout requires forbidden changes; log backlog and stop. | READY |
| S-04 | KVA Import: year selector when >3 years (Hittade år + pick 3, default 3 latest); preview bucket-first per-bucket expand; Diagnostiikka collapsible; confirm button i18n (Tallenna/Spara/Save). See S-04 substeps below. | apps/web/src/components/KvaImportPreview.tsx, apps/web/src/api.ts, apps/api/src/budgets/budget-import.service.ts, apps/web/src/i18n/locales/fi.json (and sv, en) | When Excel has >3 years, user picks 3; preview = 3 cards, 4 buckets, expand per bucket; warnings in collapsible Diagnostiikka; confirm shows FI/SWE/ENG label. | | Stop if API cannot accept selected years; log backlog and stop. | TODO |
| S-05 | Validation + i18n + gates: red error when required buckets missing; i18n for Hittade år, Källa, missing-bucket error (FI/SWE/ENG); regression tests; root gates. See S-05 substeps below. | apps/api/src/budgets/va-import/**, apps/web/src/components/KvaImportPreview.tsx, apps/web/src/i18n/locales/*.json, apps/api/src/budgets/**/*.spec.ts | Missing-bucket returns red error; all new strings in fi/sv/en; tests pass; pnpm lint && typecheck && test pass. | | Stop if gates fail; fix or log and stop. | TODO |

### S-01 substeps
- [x] Add Prisma schema: importBatchId on Talousarvio (or TalousarvioBatch table); importSourceFileName, importedAt for Källa (per budget or per batch)
  - files: prisma/schema.prisma
  - run: pnpm --filter ./apps/api exec -- prisma validate
  - evidence: commit:035460f | run: valid | files: apps/api/prisma/schema.prisma | docs: N/A | status: clean
- [x] Create and run migration for batch + Källa fields
  - files: prisma/schema.prisma, apps/api/prisma/migrations/**
  - run: pnpm --filter ./apps/api exec -- prisma migrate dev --name add_import_batch_kalla
  - evidence: commit:d8841ec | run: migration applied | files: migrations/20260212143241_add_import_batch_kalla/migration.sql | docs: N/A | status: clean
- [x] KVA confirm: set same importBatchId on all 3 created/updated budgets; persist importSourceFileName and importedAt (from request or file meta)
  - files: apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budget-import.service.ts, apps/web/src/api.ts (confirm payload if needed)
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts
  - evidence: commit:e209e20 | run: PASS 28 tests | files: budgets.repository.ts, .spec.ts, controller, KvaImportPreview, api.ts | docs: N/A | status: clean
- [x] Regression: existing confirm + list tests still pass
  - files: apps/api/src/budgets/**/*.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/
  - evidence: commit:e209e20 | run: PASS 4 suites 107 tests | files: — | docs: N/A | status: clean

### S-02 substeps
- [x] API: add or extend endpoint to list budget sets (e.g. distinct importBatchId per org) and to get budgets by batch id (return 3 budgets for year cards)
  - files: apps/api/src/budgets/budgets.controller.ts, apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/budgets.repository.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/
  - evidence: commit:5781f09 | run: PASS | files: as above | docs: N/A | status: clean
- [x] Web API: add getBudgetSet(batchId) or equivalent; BudgetPage selector loads sets and on select fetches 3 budgets for chosen set
  - files: apps/web/src/api.ts, apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:5781f09 | run: PASS | files: api.ts, BudgetPage.tsx | docs: N/A | status: clean
- [x] When a set is selected, pass 3 budgets (or batch id) into Talousarvio content so S-03 can render 3 year cards
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/
  - evidence: commit:5781f09 | run: PASS 4 tests | files: BudgetPage.tsx | docs: N/A | status: clean

### S-03 substeps
- [x] Talousarvio main content: when viewing a set, render 3 year cards (oldest→newest), one per budget; card header "Vuosi YYYY" + Tulos (green/red)
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/App.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:ca2459b | run: PASS | files: as above | docs: N/A | status: clean
- [x] Each card: 4 bucket rows (Tulot, Kulut, Poistot, Investoinnit); Investoinnit always shown (0 if empty); per-bucket expand to detail rows (label + EUR) summing to bucket total
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/
  - evidence: commit:ca2459b | run: PASS 6 tests | files: BudgetPage.tsx | docs: N/A | status: clean
- [x] Card footer: Tulos = Tulot − Kulut − Poistot − Investoinnit; colour by sign. Remove "+ Lägg till rad" when useValisummaAsRows (valisummat-only view)
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:ca2459b | run: PASS | files: BudgetPage.tsx | docs: N/A | status: clean
- [x] Källa: show "Källa: Importerad från Excel (filnamn + datum)" on each year card using stored importSourceFileName and importedAt
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:ca2459b | run: PASS | files: as above | docs: N/A | status: clean

### S-04 substeps
- [ ] When Excel has >3 years: show "Hittade år: …" and UI to pick exactly 3 (e.g. checkbox chips); default 3 latest; pass selected years to preview and confirm
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/api.ts, apps/api/src/budgets/budget-import.service.ts (accept selectedYears in confirm if needed)
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run: PASS | files: as above | docs: N/A | status: clean
- [ ] Preview: 3 year cards, 4 bucket rows per card, collapsed by default; expand per bucket (not whole year) to show detail rows
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/App.css
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run: PASS | files: KvaImportPreview.tsx | docs: N/A | status: clean
- [ ] Diagnostiikka: move "Skipped N non-account rows" etc. into collapsible block; no yellow warning in normal flow; keep copy button if useful
  - files: apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run: PASS | files: KvaImportPreview.tsx | docs: N/A | status: clean
- [ ] Confirm button i18n: FI "Tallenna", SWE "Spara", ENG "Save" (kva.confirmCta or equivalent in fi.json, sv.json, en.json)
  - files: apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json (or equivalent), apps/web/src/i18n/locales/en.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run: PASS | files: locales/*.json | docs: N/A | status: clean

### S-05 substeps
- [ ] API: when required buckets (Tulot/Kulut/Poistot) missing for a year, return validation error; surface as red error in modal (no yellow for expected skips)
  - files: apps/api/src/budgets/budget-import.service.ts, apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/api test -- src/budgets/ && pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run: PASS | files: as above | docs: N/A | status: clean
- [ ] i18n: add Hittade år, Källa template, missing-bucket error (FI/SWE/ENG) where applicable
  - files: apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run: PASS | files: locales/*.json | docs: N/A | status: clean
- [ ] Regression: existing KVA and BudgetPage tests pass; add or adjust tests for set-based load and 3 year cards if needed
  - files: apps/web/src/pages/__tests__/*.test.tsx, apps/web/src/components/KvaImportPreview.test.tsx, apps/api/src/budgets/**/*.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/ && pnpm --filter ./apps/web test
  - evidence: commit:<hash> | run: PASS | files: as needed | docs: N/A | status: clean
- [ ] Root gates: pnpm lint && pnpm typecheck && pnpm test
  - files: (whole repo)
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence: commit:<hash> | run: PASS | files: — | docs: N/A | status: clean
