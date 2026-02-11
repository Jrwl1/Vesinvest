# Sprint

Window: 2026-02-11 to 2026-05-20

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
| S-01 | Make KVA Excel import customer-usable from `KVA totalt` with extraction preview and Talousarvio write.
- [x] Add fixture-driven regression test proving extraction targets `KVA totalt` and not `Blad1`
  - files: apps/api/src/budgets/va-import/kva-template.adapter.spec.ts, fixtures/Simulering av kommande l?nsamhet KVA.xlsx
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:3d8bb3e | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> PASS | files:apps/api/src/budgets/va-import/kva-template.adapter.spec.ts | docs:N/A | status: clean
- [x] Implement deterministic year-column selection for the latest 3 years from sheet `KVA totalt`
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:d531be2 | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> PASS | files:apps/api/src/budgets/va-import/kva-template.adapter.ts, kva-template.adapter.spec.ts | docs:N/A | status: clean
- [x] Map Vatten and Avlopp price rows and key totals into preview payload without silent zeros when cells exist
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/va-import.types.ts, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:45fd911 | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> PASS | files:kva-template.adapter.ts, kva-template.adapter.spec.ts | docs:N/A | status: clean
- [x] Add preview API contract test for per-year extracted totals and deterministic category keys
  - files: apps/api/src/budgets/budgets.service.spec.ts, apps/api/src/budgets/budgets.service.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:ee92bf7 | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> PASS | files:budgets.service.spec.ts | docs:N/A | status: clean
- [x] Update app preview copy and rendering to show "Here's what we extracted from your Excel" with year-by-year totals before confirm
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/api.ts, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:8e88e1a | run:pnpm --filter ./apps/web typecheck -> PASS | files:KvaImportPreview.tsx, locales fi/sv/en.json | docs:N/A | status: clean
- [x] Add confirm-path integration test that writes extracted values into Talousarvio for chosen org, year, and name
  - files: apps/api/src/budgets/budgets.controller.ts, apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budgets.repository.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts
  - evidence: commit:b84aae5 | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts -> PASS | files:budgets.repository.spec.ts | docs:N/A | status: clean
- [x] Add end-to-end fixture regression for preview then confirm to verify persisted Talousarvio rows and no sheet fallback to `Blad1`
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts, apps/api/src/budgets/va-import/kva-template.adapter.ts, fixtures/Simulering av kommande l?nsamhet KVA.xlsx
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:d5618d2 | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts -> PASS | files:budget-totals.contract.spec.ts | docs:N/A | status: clean
- [x] Run happy-path proof with real fixture and capture short year-by-year snippet plus Talousarvio persistence confirmation
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts, apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:ce2ec10 | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts && pnpm --filter ./apps/web typecheck -> PASS | files:budget-totals.contract.spec.ts | docs:N/A | status: clean
| `apps/api/src/budgets/va-import/**`, `apps/api/src/budgets/budgets.*`, `apps/web/src/components/KvaImportPreview.tsx`, `apps/web/src/api.ts`, `fixtures/Simulering av kommande l?nsamhet KVA.xlsx` | For a provided Excel, the app displays extracted totals for each of the latest 3 years before saving.
On confirm, those values are persisted into the correct Talousarvio records for the chosen org, year, and budget name.
Import uses sheet `KVA totalt`, not `Blad1`.
Extraction preview matches what we read with deterministic mapping and no silent zeros when source cells exist. | Substeps 1?8 done (3d8bb3e..ce2ec10). | Stop if fixture headers or category labels cannot be mapped deterministically from code and fixture; add `B-TBD-*` item with owner Customer and stop. | DONE |
| S-02 | Make preview and confirm safeguards explicit for operator trust.
- [x] Add validation that selected year must exist in extracted year columns before confirm
  - files: apps/api/src/budgets/budgets.service.ts, apps/api/src/budgets/budgets.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:4e117d6 | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> PASS | files:budgets.service.ts,budgets.service.spec.ts,budgets.controller.ts | docs:N/A | status: clean
- [x] Add validation error message when required extracted totals are missing for confirm payload
  - files: apps/api/src/budgets/budgets.controller.ts, apps/api/src/budgets/budgets.service.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:507daf1 | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> PASS | files:budgets.service.ts,budgets.service.spec.ts | docs:N/A | status: clean
- [x] Surface backend validation messages in KVA preview modal with actionable copy
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:1179e5c | run:pnpm --filter ./apps/web typecheck -> ok | files:KvaImportPreview.tsx,en/fi/sv.json | docs:N/A | status: clean
- [x] Add unit test for confirm rejection when payload references non-previewed categories
  - files: apps/api/src/budgets/budgets.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:dab1173 | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> PASS | files:budgets.service.ts,budgets.service.spec.ts | docs:N/A | status: clean
- [x] Add modal state test for disabled confirm until preview extraction is loaded
  - files: apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:297ff3d | run:pnpm --filter ./apps/web typecheck -> ok | files:KvaImportPreview.tsx,KvaImportPreview.test.tsx | docs:N/A | status: clean
- [x] Run API and web safety checks for preview-confirm guard behavior
  - files: apps/api/src/budgets/budgets.service.ts, apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:7a77119 | run:both -> PASS | files:budgets.service.ts | docs:N/A | status: clean
| `apps/api/src/budgets/budgets.service.ts`, `apps/api/src/budgets/budgets.controller.ts`, `apps/web/src/components/KvaImportPreview.tsx`, `apps/web/src/i18n/locales/*.json` | Confirm is blocked when extraction payload is invalid or incomplete, and the app explains exactly what must be fixed before save. | Substeps 1?6 done (4e117d6..7a77119). | Stop if validation requires product-policy decisions not inferable from fixture and current API contract; create backlog gap and stop. | DONE |
| S-03 | Ensure Talousarvio persistence and readback are deterministic after KVA confirm.
- [x] Add repository test for transactional write of Talousarvio + valisummat + optional account lines from confirm payload
  - files: apps/api/src/budgets/budgets.repository.spec.ts, apps/api/src/budgets/budgets.repository.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts
  - evidence: commit:95a4f95 | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts -> PASS | files:budgets.repository.spec.ts | docs:N/A | status: clean
- [x] Add guard against duplicate name-year writes for confirm path and assert deterministic 409 behavior
  - files: apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budgets.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:b0aec6e | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> PASS | files:budgets.service.ts,budgets.service.spec.ts | docs:N/A | status: clean
- [x] Verify `GET /budgets/:id` returns persisted valisummat with expected category keys and types
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts, apps/api/src/budgets/budgets.repository.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:9820eda | run:PASS | files:budget-totals.contract.spec.ts | docs:N/A | status: clean
- [x] Align web BudgetPage read model for imported valisummat categories and year labels
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:e5a3bcc | run:ok | files:api.ts,BudgetPage.tsx | docs:N/A | status: clean
- [x] Add regression assertion for hard reload showing imported values without white screen
  - files: apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx, apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:f2302ac | run:PASS | files:BudgetPage.hooks-order.test.tsx | docs:N/A | status: clean
- [x] Run persistence-readback verification bundle
  - files: apps/api/src/budgets/**, apps/web/src/pages/BudgetPage.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:c8d8cd6 | run:PASS | files:budget-totals.contract.spec.ts | docs:N/A | status: clean
| `apps/api/src/budgets/budgets.repository.ts`, `apps/api/src/budgets/budgets.repository.spec.ts`, `apps/api/src/budgets/budget-totals.contract.spec.ts`, `apps/web/src/pages/BudgetPage.tsx`, `apps/web/src/api.ts` | After confirm, persisted Talousarvio data is transactionally saved and visible through read APIs and BudgetPage reload without regressions. | Substeps 1?6 done (95a4f95..c8d8cd6). | Stop if persistence integrity requires schema migration outside sprint scope; record scope gap and stop. | DONE |
| S-04 | Lock deterministic regression coverage for KVA import workflow.
- [ ] Add adapter regression suite for `KVA totalt` header variants and year-order edge cases
  - files: apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Add service-level regression suite for preview payload determinism across repeated uploads
  - files: apps/api/src/budgets/budgets.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Add repository regression suite for confirm idempotency and duplicate protection
  - files: apps/api/src/budgets/budgets.repository.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Add web regression checks for preview rendering of three-year totals and warnings
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
- [ ] Run deterministic regression bundle for adapter, service, repository, and web typing
  - files: apps/api/src/budgets/**, apps/web/src/components/KvaImportPreview.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts && pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
- [ ] Run root gates after KVA regression updates
  - files: package.json, apps/api/src/budgets/**, apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm lint && pnpm typecheck
  - evidence: commit:<hash> | run:pnpm lint && pnpm typecheck -> <result> | files:<actual changed paths> | status: clean
| `apps/api/src/budgets/va-import/kva-template.adapter.spec.ts`, `apps/api/src/budgets/budgets.service.spec.ts`, `apps/api/src/budgets/budgets.repository.spec.ts`, `apps/web/src/components/KvaImportPreview.tsx`, `package.json` | KVA import behavior is covered by deterministic regression checks and root lint/typecheck remain green after changes. | Pending DO evidence. | Stop if regression setup requires external fixture dependencies unavailable in repository context; log blocker and stop. | TODO |
| S-05 | Produce customer-verifiable happy-path evidence for KVA import workflow.
- [ ] Prepare deterministic fixture test data reference for customer demo run
  - files: fixtures/Simulering av kommande l?nsamhet KVA.xlsx, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Add scriptable proof step that logs extracted year-by-year values from preview API response
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts, apps/api/src/budgets/budgets.controller.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Add proof assertion that confirm writes values into Talousarvio rows for selected org, year, and budget name
  - files: apps/api/src/budgets/budgets.repository.spec.ts, apps/api/src/budgets/budgets.repository.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Align web confirmation flow copy so user confirms extracted values before write
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
- [ ] Execute full import happy-path bundle from preview to confirm and capture concise extracted-values snippet
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts, apps/web/src/components/KvaImportPreview.tsx, fixtures/Simulering av kommande l?nsamhet KVA.xlsx
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts && pnpm --filter ./apps/web typecheck -> <PASS; extracted: 2022=<...>, 2023=<...>, 2024=<...>; talousarvio write confirmed> | files:<actual changed paths> | status: clean
- [ ] Run root release gate for import readiness evidence
  - files: package.json, apps/api/src/budgets/**, apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm release-check
  - evidence: commit:<hash> | run:pnpm release-check -> <result> | files:<actual changed paths> | status: clean
| `fixtures/Simulering av kommande l?nsamhet KVA.xlsx`, `apps/api/src/budgets/**`, `apps/web/src/components/KvaImportPreview.tsx`, `package.json` | Happy-path proof shows year-by-year extracted values from the real fixture and confirms Talousarvio persistence after user confirmation. | Pending DO evidence. | Stop if proof cannot be produced without changing forbidden PLAN scope; keep row TODO and document blocker. | TODO |

