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

**Talousarvio tab view (locked):** Keep "Talousarvio" name; add top-of-page message that it is historical base for projection; history fully manually enterable (empty state + Add a line under TULOT and KULUT); row labels (no raw categoryKey); TULOS prominence and section styling.

**KVA import lockdown (Option A, still in force):** Talousarvio import uses only sheet **KVA totalt**. One row per P&L category per year. No Vatten KVA / Avlopp KVA in this import path.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
|---|---|---|---|---|---|---|
| S-01 | Talousarvio page: add clear top-of-page message that this is the historical base used for projection. See S-01 substeps below. | apps/web/src/pages/BudgetPage.tsx, apps/web/src/i18n/locales/fi.json, apps/web/src/i18n/locales/sv.json, apps/web/src/i18n/locales/en.json | Message visible at top (e.g. "Toteutuneet lukemat — perusta ennusteelle" / "Historical figures — base for forecast"); fi/sv/en keys present. | ab0ff77 cf79c55 | Stop if copy conflicts with canonical; log backlog and stop. | READY |
| S-02 | Talousarvio: empty state (looks good when no lines) and Add a line under TULOT and under KULUT; API support to create/persist manual lines. See S-02 substeps below. | apps/web/src/pages/BudgetPage.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json, apps/api (if new endpoint or extend createBudgetLine/valisumma) | Empty budget shows clean sections and placeholder; "Add income line" under TULOT and "Add expense line" under KULUT; new lines persist and display; app usable without Excel. | 2ec1674 | Stop if backend contract cannot support manual lines; log backlog and stop. | READY |
| S-03 | Talousarvio: row labels — ensure valisumma label from API; i18n fallback for categoryKey so UI never shows raw keys (e.g. sales_revenue, other_income). See S-03 substeps below. | apps/web/src/pages/BudgetPage.tsx, apps/web/src/i18n/locales/*.json, optionally apps/api (ensure label stored/returned) | Table and 3-year card details show human labels only; known categoryKeys have i18n fallback. | ffbe1d5 | Stop if API cannot return label; log backlog and stop. | READY |
| S-04 | Talousarvio: TULOS result block prominence (card or bar, surplus/deficit styling) and section hierarchy styling (TULOT/KULUT/INVESTOINNIT spacing and weight). See S-04 substeps below. | apps/web/src/pages/BudgetPage.tsx, apps/web/src/App.css | TULOS is visually distinct; section titles have clear weight; spacing consistent. | | Stop if layout requires forbidden file changes; log and stop. | TODO |
| S-05 | Talousarvio tab view: regression (BudgetPage render, manual add flow) and root gates (lint, typecheck, test). See S-05 substeps below. | apps/web/src/pages/BudgetPage.tsx, tests | Existing BudgetPage tests pass; root pnpm lint/typecheck/test pass. | | Stop if gates fail; fix or log and stop. | TODO |

### S-01 substeps
- [x] Add i18n keys for Talousarvio historical-base message (fi: e.g. "Toteutuneet lukemat — perusta ennusteelle", sv/en equivalents)
  - files: apps/web/src/i18n/locales/fi.json, sv.json, en.json
  - run: pnpm --filter web typecheck
  - evidence: commit:ab0ff77 | run: pnpm --filter web typecheck -> PASS | files: fi.json, sv.json, en.json | docs: N/A | status: clean
- [x] Render message at top of BudgetPage (below or beside page title) using t(key)
  - files: apps/web/src/pages/BudgetPage.tsx
  - run: pnpm --filter web typecheck
  - evidence: commit:cf79c55 | run: pnpm --filter web typecheck -> PASS | files: BudgetPage.tsx, App.css | docs: N/A | status: clean

### S-02 substeps
- [x] Design empty state: when budget has no lines (or only Perusmaksu), show clean section headers and subtle placeholder; no big blank tables
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck
  - evidence: commit:2ec1674 | run: pnpm --filter web typecheck -> PASS | files: BudgetPage.tsx, App.css | docs: N/A | status: clean
- [x] Add "Add income line" control under TULOT section and "Add expense line" under KULUT (i18n keys; button or link)
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: commit:2ec1674 | run: pnpm --filter web typecheck -> PASS | files: BudgetPage.tsx, fi.json, sv.json, en.json | docs: N/A | status: clean
- [x] Implement handler: add new row (name/label + amount); persist via existing createBudgetLine or new valisumma endpoint; refresh list
  - files: apps/web/src/pages/BudgetPage.tsx, optionally apps/api (budgets controller/service)
  - run: pnpm --filter api test -- src/budgets/ (if API change); pnpm --filter web typecheck
  - evidence: commit:2ec1674 | run: pnpm --filter web typecheck -> PASS | files: BudgetPage.tsx | docs: N/A | status: clean

### S-03 substeps
- [x] Ensure API returns label for valisummat (confirm KVA confirm path and GET budget include label); fix if missing
  - files: apps/api (if needed), apps/web (consumption)
  - run: pnpm --filter api test -- src/budgets/
  - evidence: commit:ffbe1d5 | run: pnpm --filter api test -- src/budgets/ -> 4 passed | files: budgets.repository.spec.ts | docs: N/A | status: clean
- [x] Add i18n fallback map for known categoryKeys (sales_revenue, other_income, personnel_costs, etc.) in BudgetPage; use when label empty
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter web typecheck
  - evidence: commit:ffbe1d5 | run: pnpm --filter web typecheck -> PASS | files: BudgetPage.tsx, fi.json, sv.json, en.json | docs: N/A | status: clean

### S-04 substeps
- [ ] Style TULOS result block as prominent card or bar; keep surplus/deficit green/red
  - files: apps/web/src/pages/BudgetPage.tsx, apps/web/src/App.css
  - run: pnpm --filter web typecheck
  - evidence:
- [ ] Apply section hierarchy styling (TULOT/KULUT/INVESTOINNIT): title weight, spacing
  - files: apps/web/src/App.css
  - run: N/A
  - evidence:

### S-05 substeps
- [ ] Run BudgetPage-related tests and fix any regressions
  - files: apps/web/src/pages/BudgetPage.tsx or tests
  - run: pnpm --filter web test; pnpm --filter api test -- src/budgets/
  - evidence:
- [ ] Run root gates: pnpm lint, pnpm typecheck, pnpm test (or release-check)
  - files: (none or fix only)
  - run: pnpm lint && pnpm typecheck && pnpm test
  - evidence:
