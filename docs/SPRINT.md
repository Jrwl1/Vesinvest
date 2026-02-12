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
| S-01 | Parser and fixture contract for 3 historical years from `KVA totalt`.
- [x] Add fixture assertions that totals source is `KVA totalt` and selected years are exposed.
  - files: apps/api/src/budgets/va-import/kva-template.adapter.spec.ts, apps/api/src/budgets/budget-totals.contract.spec.ts, fixtures/Simulering av kommande l?nsamhet KVA.xlsx
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:fb8c489 | run:pnpm --filter ./apps/api test -> PASS 52 passed 2 skipped | files:budget-totals.contract.spec.ts | docs:N/A | status: clean
- [x] Add tests for deterministic year pick: first 3 historical years, fallback earliest 3 when style metadata is missing.
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:992b883 | run:pnpm --filter ./apps/api test -> PASS 46 passed | files:kva-template.adapter.spec.ts | docs:N/A | status: clean
- [x] Add exclusion tests for forecast/prognosis years and all `F?r?ndring i...` rows.
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:fc23f18 | run:pnpm --filter ./apps/api test -> PASS 47 passed | files:kva-template.adapter.spec.ts | docs:N/A | status: clean
- [ ] Add concise fixture snapshot proof with year-by-year totals and section keys.
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts -> <result with year snippet> | files:<actual changed paths> | status: clean
- [ ] Run parser regression bundle for historical import contract.
  - files: apps/api/src/budgets/va-import/**, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
| `apps/api/src/budgets/va-import/**`, `apps/api/src/budgets/budget-totals.contract.spec.ts`, `fixtures/Simulering av kommande l?nsamhet KVA.xlsx` | Import source is `KVA totalt`; 3 historical years are selected deterministically; forecast and `F?r?ndring i...` rows are excluded; fixture proof shows year totals before apply. | Substep 1-3 done (fb8c489..fc23f18). | Stop if historical-year detection cannot be made deterministic from workbook data. | IN_PROGRESS |

| S-02 | Parser and mapping implementation for atomic scoped historical import payload.
- [ ] Refactor preview to produce historical totals and hierarchy from `KVA totalt` without Blad1 totals dependency.
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/va-import.types.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Map values to atomic scopes (`vesi`, `j?tevesi`, `muu`) and keep totals derived, not stored as imported rows.
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/va-import.types.ts, apps/api/src/budgets/budgets.repository.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Keep section hierarchy and deterministic ordering for Tulot, Kulut, Poistot, and Investoinnit when present.
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Remove default KVA preview branches for Tuloajurit and Blad1 Tilitason rivit payloads.
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts, apps/api/src/budgets/va-import/va-import.types.ts, apps/api/src/budgets/budget-import.service.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Run API regression bundle for parser and payload contract.
  - files: apps/api/src/budgets/va-import/**, apps/api/src/budgets/budget-import.service.ts, apps/api/src/budgets/budget-totals.contract.spec.ts, apps/api/src/budgets/budgets.repository.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts -> <result> | files:<actual changed paths> | status: clean
| `apps/api/src/budgets/va-import/**`, `apps/api/src/budgets/budget-import.service.ts`, `apps/api/src/budgets/budgets.repository.ts`, `apps/api/src/budgets/budgets.repository.spec.ts` | Payload contains only agreed historical import data with hierarchy and atomic scopes from `KVA totalt`; no forecast, no `F?r?ndring i...`, no default import-time Tuloajurit or Blad1 account rows. | Evidence needed. | Stop if scoped mapping requires out-of-scope schema migration. | TODO |
| S-03 | Import modal UX cleanup: year cards preview first, then confirm apply.
- [ ] Remove Tuloajurit block and import-time volume or connection warnings from KVA modal.
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Remove Blad1 Tilitason rivit section from default modal flow.
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Replace single-year selector with detected-years list and per-year cards in deterministic order.
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/App.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
- [ ] Add expandable year sections showing imported atomic lines grouped by Tulot, Kulut, Poistot, Investoinnit when present.
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Update confirm payload builder to send only agreed historical payload and extracted year set.
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
- [ ] Run web regression bundle for KVA modal preview and payload behavior.
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx, apps/web/src/api.ts, apps/web/src/App.css
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx && pnpm --filter ./apps/web typecheck -> <result> | files:<actual changed paths> | status: clean
| `apps/web/src/components/KvaImportPreview.tsx`, `apps/web/src/components/KvaImportPreview.test.tsx`, `apps/web/src/api.ts`, `apps/web/src/App.css`, `apps/web/src/i18n/locales/*.json` | User sees extracted numbers per year before applying, can expand year details, and cannot import Tuloajurit or Blad1 account-level rows in default flow. | Evidence needed. | Stop if required per-year preview cannot be rendered without unresolved API payload gap from S-02. | TODO |

| S-04 | Confirm apply flow and Talousarvio rendering aligned with historical baseline semantics.
- [ ] Tighten KVA confirm DTO and service to totals-only historical payload contract.
  - files: apps/api/src/budgets/budgets.controller.ts, apps/api/src/budgets/budgets.service.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Implement create or update writes for each imported historical year by org and budget name.
  - files: apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budgets.repository.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.repository.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Persist section-scoped lines for Tulot, Kulut, Poistot, Investoinnit and keep Tulos derived.
  - files: apps/api/src/budgets/budgets.repository.ts, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Update Talousarvio page rendering so historical imported values are not overridden by tuloajurit-derived rows.
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Remove Talousarvio-tab dependency on RevenueDriversPanel inputs while keeping drivers for Tulot or Ennuste pages.
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/components/RevenueDriversPanel.tsx, apps/web/src/pages/__tests__/RevenueDriversPanel.test.tsx
  - run: pnpm --filter ./apps/web test -- src/pages/__tests__/RevenueDriversPanel.test.tsx src/pages/__tests__/BudgetPage.hooks-order.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/pages/__tests__/RevenueDriversPanel.test.tsx src/pages/__tests__/BudgetPage.hooks-order.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Run cross-stack regression bundle for confirm apply plus Talousarvio rendering.
  - files: apps/api/src/budgets/*.spec.ts, apps/web/src/pages/BudgetPage.tsx, apps/web/src/pages/__tests__/*.test.tsx, apps/web/src/api.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts && pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx src/pages/__tests__/RevenueDriversPanel.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts && pnpm --filter ./apps/web test -- src/pages/__tests__/BudgetPage.hooks-order.test.tsx src/pages/__tests__/RevenueDriversPanel.test.tsx -> <result> | files:<actual changed paths> | status: clean
| `apps/api/src/budgets/budgets.controller.ts`, `apps/api/src/budgets/budgets.service.ts`, `apps/api/src/budgets/budgets.repository.ts`, `apps/api/src/budgets/*.spec.ts`, `apps/web/src/pages/BudgetPage.tsx`, `apps/web/src/components/RevenueDriversPanel.tsx`, `apps/web/src/pages/__tests__/*.test.tsx`, `apps/web/src/api.ts` | Confirm apply persists historical imports into correct Talousarvio records for chosen org and name; Talousarvio shows imported lines and derived totals without requiring tuloajurit inputs. | Evidence needed. | Stop if persistence or rendering change requires forbidden cross-epic scope expansion. | TODO |

| S-05 | End-to-end customer proof and hard quality gates.
- [ ] Add fixture-backed proof test output that prints short extracted totals snippet for each imported historical year before apply.
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts, fixtures/Simulering av kommande l?nsamhet KVA.xlsx
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts -> <PASS with year snippets> | files:<actual changed paths> | status: clean
- [ ] Verify confirm create and update behavior across 3 historical years for chosen org and budget name.
  - files: apps/api/src/budgets/budgets.service.spec.ts, apps/api/src/budgets/budgets.repository.spec.ts, apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budgets.service.spec.ts src/budgets/budgets.repository.spec.ts src/budgets/budget-totals.contract.spec.ts -> <result> | files:<actual changed paths> | status: clean
- [ ] Verify UI preview cards and year expanders show extracted values before confirm.
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/components/KvaImportPreview.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:<hash> | run:pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx -> <result> | files:<actual changed paths> | status: clean
- [ ] Run root quality gates in deterministic order.
  - files: package.json, apps/api/src/budgets/**, apps/web/src/components/KvaImportPreview.tsx, apps/web/src/pages/BudgetPage.tsx, apps/web/src/api.ts
  - run: pnpm lint && pnpm typecheck && pnpm release-check
  - evidence: commit:<hash> | run:pnpm lint && pnpm typecheck && pnpm release-check -> <result> | files:<actual changed paths> | status: clean
- [ ] Everything works as intended on Talousarvio page.
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/components/KvaImportPreview.tsx, apps/api/src/budgets/budget-totals.contract.spec.ts, apps/api/src/budgets/budgets.repository.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts && pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx src/pages/__tests__/BudgetPage.hooks-order.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts src/budgets/budgets.repository.spec.ts && pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx src/pages/__tests__/BudgetPage.hooks-order.test.tsx && pnpm --filter ./apps/web typecheck -> <PASS with preview snippet and Talousarvio confirmation> | files:<actual changed paths> | status: clean
| `fixtures/Simulering av kommande l?nsamhet KVA.xlsx`, `apps/api/src/budgets/budget-totals.contract.spec.ts`, `apps/api/src/budgets/budgets.service.spec.ts`, `apps/api/src/budgets/budgets.repository.spec.ts`, `apps/web/src/components/KvaImportPreview.tsx`, `apps/web/src/components/KvaImportPreview.test.tsx`, `apps/web/src/pages/BudgetPage.tsx`, `apps/web/src/pages/__tests__/BudgetPage.hooks-order.test.tsx`, `package.json` | For provided Excel, app previews extracted totals for 3 historical years before save; on confirm, values are persisted into correct Talousarvio records for chosen org and name; totals source is `KVA totalt`; mapping is deterministic with no silent zeros when source cells exist. | Evidence needed. | Stop if end-to-end proof cannot be automated with current test stack; add backlog harness item and stop. | TODO |
