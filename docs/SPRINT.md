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
Do cell formatting guardrails:
- No HTML tags like `<br>` inside cells.
- Avoid extra literal `|` characters in `Do` cell lines outside the required `evidence:` format.
Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
`DONE` is set by `REVIEW` only after Acceptance is verified against Evidence.

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Lock KVA parser to 3 historical years and agreed row filtering from `KVA totalt`.
- [x] Add regression fixture checks that totals source is `KVA totalt`; keep Blad1 only as optional account-tier source (not totals)
  - files: apps/api/src/budgets/va-import/kva-template.adapter.spec.ts, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:ff84242 | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts -> PASS 2 suites 47 passed | files:apps/api/src/budgets/budget-totals.contract.spec.ts | docs:N/A | status: clean
- [x] Replace year selection helper with historical-year selector for `KVA totalt` (prefer style-aware gray detection when reliable)
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:45f4126 | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> PASS 50 tests | files:kva-template.adapter.ts kva-template.adapter.spec.ts | docs:N/A | status: clean
- [x] Implement deterministic fallback rule when style is not detectable: earliest 3 year columns in KVA totals table
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/va-import.types.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:fdb41e5 | run:pnpm --filter ./apps/api test -> PASS 45 tests | files:kva-template.adapter.ts va-import.types.ts kva-template.adapter.spec.ts | docs:N/A | status: clean
- [x] Exclude all `F?r?ndring i...` and forecast/prognosis rows from subtotal extraction
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:0b5f67f | run:pnpm test -> PASS 46 tests | files:kva-template.adapter.ts kva-template.adapter.spec.ts | docs:N/A | status: clean
- [x] Add hierarchy metadata to subtotal payload (category plus subrow level and deterministic order)
  - files: apps/api/src/budgets/va-import/va-import.types.ts, apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:d036fd1 | run:pnpm test -> PASS 53 tests | files:va-import.types.ts kva-template.adapter.ts kva-template.adapter.spec.ts | docs:N/A | status: clean
- [x] Expose parser debug fields that prove selected historical years and excluded row groups
  - files: apps/api/src/budgets/va-import/va-import.types.ts, apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/budget-import.service.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:d036fd1 | run:pnpm test -> PASS | files:va-import.types.ts kva-template.adapter.ts | docs:N/A | status: clean
- [x] Run parser regression bundle for historical-year and filtering behavior
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts, apps/api/src/budgets/budget-import.service.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:1e2d070 | run:pnpm test -> PASS 53 tests | files:budget-import.service.ts | docs:N/A | status: clean
| `apps/api/src/budgets/va-import/**`, `apps/api/src/budgets/budget-import.service.ts`, `apps/api/src/budgets/budget-totals.contract.spec.ts` | Parser returns exactly 3 historical years from `KVA totalt`, excludes forecast and `F?r?ndring i...` rows, and emits deterministic hierarchy-ready totals payload. | Substep 1-7 done (ff84242..1e2d070). Acceptance: 3 historical years, excludes forecast/F?r?ndring, hierarchy payload. | Stop if workbook structure has no deterministic way to isolate historical years; add `B-TBD-*` owner Customer and stop. | DONE |
| S-02 | Rework confirm mapping so imported per-year totals create or update Talousarvio deterministically.
- [x] Define new confirm contract for per-year totals and hierarchy payload (no import-modal Tuloajurit or Blad1 account lines)
  - files: apps/api/src/budgets/budgets.controller.ts, apps/api/src/budgets/budgets.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:ea2777f | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> PASS 18 tests | files:budgets.controller.ts budgets.service.ts budgets.service.spec.ts api.ts | docs:N/A | status: clean
- [x] Add service validation for accepted years set and hierarchy payload shape before persistence
  - files: apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/budgets.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:fb5eaaa | run:pnpm --filter ./apps/api test -> PASS 20 tests | files:budgets.service.ts budgets.service.spec.ts | docs:N/A | status: clean
- [ ] Implement repository upsert strategy per imported year and budget naming rule for chosen org
  - files: apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budgets.repository.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Preserve hierarchy ordering and category mapping when writing TalousarvioValisumma rows
  - files: apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Remove confirm-path persistence of revenue drivers from KVA flow
  - files: apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budgets.repository.spec.ts, apps/api/src/budgets/budgets.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts src/budgets/budgets.service.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts src/budgets/budgets.service.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Keep legacy account-line import endpoint separate while removing KVA confirm accountLines branch
  - files: apps/api/src/budgets/budgets.controller.ts, apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budgets.service.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Run confirm-mapping regression bundle for create and update behavior across 3 years
  - files: apps/api/src/budgets/budgets.controller.ts, apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/*.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
| `apps/api/src/budgets/budgets.controller.ts`, `apps/api/src/budgets/budgets.service.ts`, `apps/api/src/budgets/budgets.repository.ts`, `apps/web/src/api.ts`, `apps/api/src/budgets/*.spec.ts` | Confirm writes imported totals per historical year into Talousarvio deterministically (create/update), with hierarchy preserved and no KVA-import Tuloajuri/account-line writes. | Substep 1-2 done (ea2777f, fb5eaaa). | Stop if persistence semantics require schema migration outside sprint scope; record scope gap and stop. | IN_PROGRESS |
| S-03 | Redesign KVA import modal for year-by-year totals preview and simplified apply flow.
- [ ] Remove Tuloajurit table and related editable driver state from KVA modal
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Remove Blad1 account-level section and accountLines toggle from KVA modal payload
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
- [ ] Render extracted totals as 3 historical year sections/cards with clear hierarchy display
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/App.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
- [ ] Add explicit confirmation copy: "Your Excel produced these numbers per year before applying"
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
- [ ] Align BudgetPage import entry points so KVA flow is totals-only and Tulot remains manual driver editing
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Run web regression bundle for modal behavior and type safety
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx, apps/web/src/pages/BudgetPage.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx && pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
| `apps/web/src/components/KvaImportPreview.tsx`, `apps/web/src/components/KvaImportPreview.test.tsx`, `apps/web/src/pages/BudgetPage.tsx`, `apps/web/src/api.ts`, `apps/web/src/i18n/locales/*.json`, `apps/web/src/App.css` | Import modal shows only year-by-year extracted totals and confirmation UI; Tuloajurit are removed from import flow and Blad1 account-row section is not shown by default. | Pending DO evidence. | Stop if UX simplification conflicts with required manual Tulot workflow; document blocker and stop. | TODO |
| S-04 | Add deterministic test coverage for historical-year import and Talousarvio mapping.
- [ ] Add parser tests for gray-style detection path and fallback earliest-3-year path
  - files: apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Add parser tests that forecast/prognosis and `F?r?ndring i...` rows are excluded
  - files: apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Add service/repository tests that KVA confirm ignores revenueDrivers and accountLines
  - files: apps/api/src/budgets/budgets.service.spec.ts, apps/api/src/budgets/budgets.repository.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Add contract tests for per-year Talousarvio create/update mapping with hierarchy
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts, apps/api/src/budgets/budgets.repository.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Add web tests confirming modal shows 3-year totals and no Tuloajurit/Blad1 sections
  - files: apps/web/src/components/KvaImportPreview.test.tsx, apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Add fixture snapshot strategy for parser output (concise per-year JSON proof)
  - files: apps/api/src/budgets/va-import/kva-template.adapter.spec.ts, fixtures/Simulering av kommande l?nsamhet KVA.xlsx
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Run cross-stack regression bundle for parser, mapping, and modal behavior
  - files: apps/api/src/budgets/**, apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts && pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts && pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <result> | files:<actual changed paths> | status: clean
| `apps/api/src/budgets/va-import/kva-template.adapter.spec.ts`, `apps/api/src/budgets/budgets.service.spec.ts`, `apps/api/src/budgets/budgets.repository.spec.ts`, `apps/api/src/budgets/budget-totals.contract.spec.ts`, `apps/web/src/components/KvaImportPreview.test.tsx` | Tests prove historical-year extraction, row filtering, hierarchy mapping, and totals-only modal behavior are deterministic with fixture-backed evidence. | Pending DO evidence. | Stop if fixture lacks stable expected values for test assertions; add backlog gap and stop. | TODO |
| S-05 | Deliver customer-happy-path proof: Excel preview for 3 historical years then confirm write to Talousarvio.
- [ ] Prepare fixture-driven happy-path scenario using `Simulering av kommande l?nsamhet KVA.xlsx`
  - files: fixtures/Simulering av kommande l?nsamhet KVA.xlsx, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Verify preview output contains exactly 3 historical years and extracted sums per year before apply
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts, apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Confirm import writes or updates Talousarvio correctly for each imported year with hierarchy preserved
  - files: apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budgets.repository.spec.ts, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Verify KVA flow does not create or mutate Tuloajurit and does not include Blad1 account-line persistence
  - files: apps/api/src/budgets/budgets.repository.spec.ts, apps/api/src/budgets/budgets.service.spec.ts, apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts src/budgets/budgets.service.spec.ts && pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts src/budgets/budgets.service.spec.ts && pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Run root quality gates for release readiness after import-flow changes
  - files: package.json, apps/api/src/budgets/**, apps/web/src/components/KvaImportPreview.tsx, apps/web/src/api.ts
  - run: pnpm lint && pnpm typecheck && pnpm release-check
  - evidence: commit:<hash> | run:pnpm lint && pnpm typecheck && pnpm release-check -> <result> | files:<actual changed paths> | status: clean
- [ ] Happy-path proof: Excel upload shows 3 historical years plus extracted sums, user confirms, and Talousarvio is created or updated correctly
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts, apps/web/src/components/KvaImportPreview.tsx, apps/api/src/budgets/budgets.repository.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts && pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts && pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <PASS; preview years=<y1,y2,y3>; extracted=<year->sum snippet>; talousarvio upsert=<ids or years>> | files:<actual changed paths> | status: clean
| `fixtures/Simulering av kommande l?nsamhet KVA.xlsx`, `apps/api/src/budgets/budget-totals.contract.spec.ts`, `apps/api/src/budgets/budgets.repository.spec.ts`, `apps/web/src/components/KvaImportPreview.tsx`, `apps/web/src/components/KvaImportPreview.test.tsx`, `package.json` | Working flow matches agreement: Excel upload shows extracted sums for 3 historical years, confirm applies them into Talousarvio correctly, and root gates pass. | Pending DO evidence. | Stop if happy-path proof requires forbidden PLAN-scope edits; keep TODO and log blocker. | TODO |
