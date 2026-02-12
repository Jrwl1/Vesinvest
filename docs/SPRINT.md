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

**KVA import lockdown (Option A, locked):** Talousarvio import uses only the sheet **KVA totalt**. One row per P&L category per year. No Vatten KVA / Avlopp KVA in this import path. Layout documented during implementation via inspect script.

**Previous (still in force):** Sign convention Option A (ADR-021); KVA totalt rows per SUBTOTAL_CATEGORIES (ADR-022); import batch + Källa; 3 year cards, 4 buckets, per-bucket expand; confirm i18n FI/SWE/ENG.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | KVA Import preview UI: underrow amounts max 2 decimals; € symbol next to underrow input. See S-01 substeps below. | apps/web/src/components/KvaImportPreview.tsx, apps/web/src/App.css | Underrow amount displays and inputs show at most 2 decimals; € visible next to each underrow amount box. | 84244af | Stop if UI contract breaks; log backlog and stop. | IN_PROGRESS |
| S-02 | KVA Import preview UI: Tulot label green, Kulut label red (bucket labels only; underrow category names stay black). See S-02 substeps below. | apps/web/src/components/KvaImportPreview.tsx, apps/web/src/App.css | Tulot bucket row label is green; Kulut bucket row label is red; underrows unchanged. | | Stop if layout requires forbidden changes; log backlog and stop. | TODO |
| S-03 | KVA extraction: restrict extractSubtotalLines to KVA totalt sheet only (remove Vatten KVA, Avlopp KVA from sheetTargets). See S-03 substeps below. | apps/api/src/budgets/va-import/kva-template.adapter.ts | sourceSheets contains only "KVA totalt"; one line per (categoryKey, year) in preview. | | Stop if extraction cannot be restricted; log backlog and stop. | TODO |
| S-04 | KVA extraction: update tests and fixture expectations for KVA totalt only; run fixture contract test; confirm one row per (categoryKey, year). See S-04 substeps below. | apps/api/src/budgets/va-import/kva-template.adapter.spec.ts, apps/api/src/budgets/budget-totals.contract.spec.ts | All budget tests pass; fixture-backed test expects sourceSheets = ["KVA totalt"]; no duplicate category rows per year. | | Stop if gates fail; fix or log and stop. | TODO |
| S-05 | KVA import lockdown doc and verification: docs/KVA_IMPORT_LOCKDOWN.md with KVA totalt layout (discovered during impl), Option A contract, verification steps. See S-05 substeps below. | docs/KVA_IMPORT_LOCKDOWN.md | Doc exists; states single-source KVA totalt; verification steps (inspect script, spot-check) documented. | | Stop if doc would conflict with canonical; log and stop. | TODO |

### S-01 substeps
- [x] Format underrow amount display to max 2 decimals (e.g. toFixed(2) for display; round on change/blur before updateSubtotalAmount)
  - files: apps/web/src/components/KvaImportPreview.tsx
  - run: pnpm --filter ./apps/web test -- src/components/KvaImportPreview.test.tsx
  - evidence: commit:84244af | run: PASS | files: KvaImportPreview.tsx | docs: N/A | status: clean
- [ ] Add € symbol next to underrow amount input in detail row
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/App.css (if needed)
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run: PASS | files: as above | docs: N/A | status: clean

### S-02 substeps
- [ ] Add class or data-attribute per bucket row (income vs cost); style Tulot (income) label green, Kulut (cost) label red in App.css
  - files: apps/web/src/components/KvaImportPreview.tsx, apps/web/src/App.css
  - run: pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run: PASS | files: as above | docs: N/A | status: clean

### S-03 substeps
- [ ] In extractSubtotalLines, set sheetTargets to only { name: KVA_TOTALT_SHEET } (remove Vatten KVA, Avlopp KVA)
  - files: apps/api/src/budgets/va-import/kva-template.adapter.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/va-import/kva-template.adapter.spec.ts
  - evidence: commit:<hash> | run: PASS | files: kva-template.adapter.ts | docs: N/A | status: clean

### S-04 substeps
- [ ] Update kva-template.adapter.spec.ts: expect sourceSheets to contain only "KVA totalt" where applicable; adjust tests that expected Vatten KVA / Avlopp KVA
  - files: apps/api/src/budgets/va-import/kva-template.adapter.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/
  - evidence: commit:<hash> | run: PASS | files: kva-template.adapter.spec.ts | docs: N/A | status: clean
- [ ] Run fixture-backed contract test (budget-totals.contract.spec.ts); confirm one row per (categoryKey, year) when fixture present
  - files: apps/api/src/budgets/budget-totals.contract.spec.ts
  - run: pnpm --filter ./apps/api test -- src/budgets/budget-totals.contract.spec.ts
  - evidence: commit:<hash> | run: PASS | files: as needed | docs: N/A | status: clean

### S-05 substeps
- [ ] Create docs/KVA_IMPORT_LOCKDOWN.md: document Option A (only KVA totalt); add "Layout" section (discovered via inspect script during impl); add Verification steps (inspect script, import preview, spot-check)
  - files: docs/KVA_IMPORT_LOCKDOWN.md
  - run: N/A
  - evidence: commit:<hash> | run: N/A | files: docs/KVA_IMPORT_LOCKDOWN.md | docs: N/A | status: clean
