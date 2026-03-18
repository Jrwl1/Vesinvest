# Sprint

Window: 2026-03-18 to 2026-05-30

Executable DO queue. Execute top-to-bottom.
Each `Do` cell checklist must stay flat and may include as many substeps as needed.
Each substep must be small enough to complete in one DO run.
Evidence policy: commit-per-packet. Each checked substep must include packet hash + run summary + changed files.
Execution policy: after `DO` or `RUNSPRINT` entry, run continuous `DO -> REVIEW` cycles until all active rows are `DONE` or a protocol stop condition/blocker is reached.
Clean-tree policy: protocol cleanliness is defined by `git status --porcelain`; ignored local files are out of scope, while tracked changes and untracked non-ignored files still block DO/REVIEW completion.
DO baseline policy: DO may start from dirty tracked/unignored state only when every pre-existing dirty path is already inside the selected packet `files:` scope and can be safely absorbed into that packet; DO and REVIEW still must end clean per `git status --porcelain`.
MCP policy: use direct MCP tools when they materially help gather evidence or verify behavior. Do not use external delegation or autopilot tooling outside the bounded native-helper rules.
DO file-scope policy: when a selected substep explicitly lists non-canonical repo docs or config examples in `files:`, DO may edit them as product-scope files; canonical planning docs remain forbidden.
PLAN subagent policy: the parent planner must still complete the required canonical reads in order, but may use read-only research helpers for follow-up context gathering only.
DO/RUNSPRINT subagent policy: the parent executor may use bounded native helper agents for the currently selected packet only; the parent remains responsible for scope, commands, commits, evidence, and clean-tree checks.
REVIEW subagent policy: REVIEW remains parent-owned unless a future ADR defines a read-only review-helper policy.
Same-package gate-fix policy: when a required `run:` fails, DO may edit the minimal additional files in the same workspace package needed to make that required run pass; cross-package fallout remains a blocker.
Blast-radius authoring policy: `files:` is a blast-radius contract, not a precise edit inventory. Prefer area scopes/globs for auth/session, browser automation, test harnesses, dependency or config changes, CI/workflow changes, and coordinated frontend/backend slices.
Implicit collateral policy: same-area collateral files are implicitly in scope when their trigger area is in scope, including `pnpm-lock.yaml` with `package.json`, same-workspace test/lint/typecheck/playwright or vitest config plus `test/**` for browser/test-harness work, and directly coupled auth/session support files.
Gate-aware authoring policy: if a substep adds or tightens a new test, parity, lint, typecheck, schema, or contract gate, its `files:` scope must include both the gate file(s) and the likely same-package implementation or consumer files that could need edits if that gate exposes drift.
Scope-correction policy: if a sprint `files:` scope missed minimal same-area collateral or directly coupled contract files required for the explicitly stated behavior, DO may widen the active row scope once to match reality; broad cross-feature expansion remains blocked.
Blocker taxonomy: use `HARD BLOCKED` for scope, forbidden-touch, commit-structure, or clean-tree failures, and `GATE BLOCKED` for required verification failures that exceed the bounded same-package gate-fix rule.
Required substep shape:

- `- [ ] <imperative action>`
- `  - files: <paths/globs>`
- `  - run: <command(s)>` (or `N/A` only when the substep text explicitly allows it)
- `  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean`
  When scoped-baseline absorption or same-package gate-fix is used, append `| baseline:absorbed` and/or `| gate-fix:<paths>` before `| status: clean`.
  Status lifecycle is strict: `TODO -> IN_PROGRESS -> READY -> DONE`.
  `DONE` is set by REVIEW only after Acceptance is verified against Evidence.

## Goal (this sprint)

Turn historical year repair into a truthful operator workflow: compare one KVA workbook against VEETI for the shared financial rows, let the user confirm selective overrides year by year, handle the 2024 statement PDF as a stronger year-specific finance source instead of a one-line fix, and then move directly into an operator-friendly `Investointiohjelma` and `Poistosaannot` entry flow at the start of Ennuste using the customer PTS workbook defaults.

## Recorded decisions (this sprint)

- VEETI remains the baseline source for imported historical years.
- The first Excel/KVA selective-override pass covers the six shared financial rows only: `Liikevaihto`, `AineetJaPalvelut`, `Henkilostokulut`, `Poistot`, `LiiketoiminnanMuutKulut`, and `TilikaudenYliJaama`.
- Workbook-driven sold-volume override is out of scope for this sprint because the current customer docs do not provide one equally clear cross-year volume source.
- The 2024 statement PDF is a stronger year-specific finance source, not merely a one-line repair source; the app must make merge ownership explicit when workbook and statement sources both affect the same year.
- Workbook-applied overrides must persist under a distinct workbook provenance (`kva_import` / `excel_import`), not generic `manual_edit`.
- `Investointiohjelma` and `Poistosaannot` entry belongs at the start of Ennuste, not in the early setup wizard.
- User-facing Ennuste wording should prefer utility language such as `Investointiohjelma`, `Poistosaannot`, `Poistotapa`, and `Poistoaika`; internal terms like class allocation and mapping stay secondary.
- PTS workbook defaults are the starting point for investment groups and depreciation rules, but users can edit them before forecast computation.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
| --- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-99 | Add the KVA selective-override contract and workbook provenance. See S-99 substeps. | apps/web/src/api.ts, apps/web/src/v2/**, apps/api/src/v2/**, apps/api/src/veeti/** | The product can represent VEETI baseline values, workbook candidate values, user-confirmed overrides, and a distinct workbook provenance on repaired historical years without falling back to generic manual provenance. | Accepted via packet evidence, focused web/api tests, and dual typecheck. | Stop if truthful selective override requires a broader historical-import rewrite beyond the current `v2/import/manual-year` and VEETI effective-data seams. | DONE |
| S-100 | Build the year-by-year workbook compare and confirmation flow for the six shared financial rows. See S-100 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/budgets/va-import/** | Users can upload one KVA workbook, see `2022`, `2023`, and `2024` matched against VEETI by year and canonical row, and explicitly choose whether to keep VEETI or apply workbook values before saving. | Accepted via parser packet, compare-UI packet, focused web/api tests, and typechecks. | Stop if the current workbook structure cannot be mapped deterministically from `KVA totalt` to years plus the six shared financial rows. | DONE |
| S-101 | Apply confirmed workbook overrides and repair the Kronoby years truthfully. See S-101 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/veeti/** | Confirmed workbook overrides persist and survive reload, Kronoby `2022` and `2023` budget sanity no longer mismatch due to missing `Material och tjanster`, and the repaired year cards show workbook provenance rather than generic manual edits. | Accepted via workbook batch-apply packet, focused web/api tests, and clean sync proof for 2022/2023. | Stop if the apply path requires a broader budget-generator or snapshot-schema rewrite outside the same feature slice. | DONE |
| S-102 | Make the 2024 merge between VEETI, KVA workbook, and statement PDF explicit. See S-102 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/veeti/** | For `2024`, the app can keep statement-PDF-backed finance values while workbook-confirmed line repairs such as `AineetJaPalvelut` remain explicit, and the year card explains the mixed-source ownership truthfully after reload. | Accepted via per-field provenance model, mixed-source UI readback, focused web/api tests, and typechecks. | Stop if truthful 2024 merge ownership cannot be represented without a broader per-field provenance model than this feature slice can safely add. | DONE |
| S-103 | Add an operator-friendly `Investointiohjelma` entry surface at the start of Ennuste. See S-103 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx | Before the denser Forecast workbenches, users get a clear `Investointiohjelma` surface with year, target, type, group, water EUR, wastewater EUR, total EUR, and note in utility language. | Evidence needed. | Stop if adding the entry surface requires replacing the existing Forecast architecture instead of layering a start surface ahead of it. | TODO |
| S-104 | Prefill `Poistosaannot` from the PTS workbook and connect them to the current depreciation engine. See S-104 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/api/src/v2/**, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts | PTS-derived investment groups and depreciation defaults appear as editable starting rules, map truthfully to the current scenario depreciation contract, and avoid internal-only jargon on the primary surface. | Evidence needed. | Stop if the PTS defaults cannot be represented truthfully by the current supported depreciation methods without adding unsupported contract types. | TODO |
| S-105 | Wire the investment-plan flow into depreciation, tariff, and cash impact views. See S-105 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Saved investment-plan inputs flow into yearly investments, depreciation preview, tariff pressure, and cash impact, and users can understand the effect without opening the full power-user workbench first. | Evidence needed. | Stop if the impact views require a broader Forecast compute-model rewrite beyond the current scenario/depreciation/investment seams. | TODO |
| S-106 | Close with focused regressions and a live Kronoby audit. See S-106 substeps. | apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts, docs/EXCEL_OVERRIDE_AND_INVESTMENT_AUDIT.md | Focused regressions pass, a wiped-workspace live audit covers Kronoby wipe, VEETI reconnect/import, workbook compare/apply, 2024 statement merge, and entry into `Investointiohjelma`, and the audit artifact ends with `whole sprint succeeded` or a blocker. | Evidence needed. | Stop if the available customer docs still leave one required source mapping untruthful in the live flow; record the blocker in the audit artifact and stop there. | TODO |

### S-99 substeps

- [x] Extend the import-year contract to represent workbook candidate values, confirmed overrides, and workbook provenance separately from generic manual edits
  - files: apps/web/src/api.ts, apps/web/src/v2/yearReview.ts, apps/api/src/v2/**, apps/api/src/veeti/**
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: packet:8f5ba990d36435870ae7dfed451eb590a78398a6 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/dto/manual-year-completion.dto.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/api/src/veeti/veeti-effective-data.service.ts,apps/web/src/api.ts,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/yearReview.ts | docs:8f5ba990d36435870ae7dfed451eb590a78398a6 | gate-fix:apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/ReportsPageV2.tsx | status: clean

- [x] Keep year-card and baseline/report provenance truthful when workbook repairs and statement-PDF repairs coexist on different years
  - files: apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/veeti/**
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:f6db7a3843d337a3f295a634aca9f3d96073786a | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/yearReview.test.ts | docs:f6db7a3843d337a3f295a634aca9f3d96073786a | status: clean

### S-100 substeps

- [x] Parse the six shared financial rows from `KVA totalt` and match workbook years deterministically against imported VEETI years
  - files: apps/api/src/budgets/va-import/**, apps/api/src/v2/**, apps/web/src/api.ts, apps/web/src/v2/**
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: packet:4c9bd2c95adafc26a620fcb19366ca7e81531a9a | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/package.json,apps/api/src/budgets/va-import/kva-workbook-preview.ts,apps/api/src/v2/v2.controller.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts,pnpm-lock.yaml | docs:N/A | status: clean

- [x] Build a workbook compare UI that shows VEETI current values, workbook candidate values, and explicit keep/apply choices per year and canonical row
  - files: apps/web/src/v2/**, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:27533f0f285b6708ca8e2ce5279202001e50aa35 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:27533f0f285b6708ca8e2ce5279202001e50aa35 | status: clean

### S-101 substeps

- [x] Persist confirmed workbook overrides for the selected years and keep unrepaired VEETI values untouched
  - files: apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/veeti/**
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:d837c3e535bbad97d186f324bd39037ed8b3bb6e | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:d837c3e535bbad97d186f324bd39037ed8b3bb6e | status: clean

- [x] Prove the Kronoby `2022` and `2023` repairs against live or fixture-backed sanity outputs so the missing `Material och tjanster` no longer leaves those budgets wrong
  - files: apps/web/src/v2/**, apps/api/src/v2/**, apps/api/src/veeti/**, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: packet:d837c3e535bbad97d186f324bd39037ed8b3bb6e | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:d837c3e535bbad97d186f324bd39037ed8b3bb6e | status: clean

### S-102 substeps

- [x] Make the 2024 merge path explicit so statement-PDF-backed finance values and workbook-backed line repairs can coexist truthfully
  - files: apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/veeti/**
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:b3d032af13275ddb4d395b113d7c39a7a60df684 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/api/src/veeti/veeti-effective-data.service.ts,apps/web/src/api.ts,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/yearReview.test.ts,apps/web/src/v2/yearReview.ts | docs:b3d032af13275ddb4d395b113d7c39a7a60df684 | status: clean

- [x] Keep 2024 source messaging literal after reload so users can see which parts come from VEETI, workbook repair, and statement PDF without guessing
  - files: apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:b3d032af13275ddb4d395b113d7c39a7a60df684 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/api/src/veeti/veeti-effective-data.service.ts,apps/web/src/api.ts,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/ReportsPageV2.tsx,apps/web/src/v2/yearReview.test.ts,apps/web/src/v2/yearReview.ts | docs:b3d032af13275ddb4d395b113d7c39a7a60df684 | status: clean

### S-103 substeps

- [ ] Add the `Investointiohjelma` start surface ahead of the denser Forecast workbenches
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Use utility-language fields for year, target, type, group, water EUR, wastewater EUR, total EUR, and note instead of internal finance jargon
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

### S-104 substeps

- [ ] Prefill investment groups and depreciation defaults from the PTS workbook and map them to the current supported depreciation methods
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Keep advanced internal terms secondary while the primary Ennuste entry uses `Poistosaannot`, `Poistotapa`, and `Poistoaika`
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

### S-105 substeps

- [ ] Wire saved investment-plan entries into yearly investments, depreciation preview, tariff pressure, and cash impact
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/api/src/v2/**, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Keep the start-of-Ennuste entry and the existing power-user workbenches aligned so users can continue into deeper edits without losing context
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

### S-106 substeps

- [ ] Add final focused regressions for workbook compare/apply, 2024 statement merge, and `Investointiohjelma`
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Run a wiped-workspace live audit for Kronoby covering wipe, reconnect/import, workbook repair, 2024 statement merge, and entry into `Investointiohjelma`
  - files: apps/web/src/v2/**, docs/EXCEL_OVERRIDE_AND_INVESTMENT_AUDIT.md
  - run: N/A (manual browser audit allowed)
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean

- [ ] Record the explicit sprint outcome in `docs/EXCEL_OVERRIDE_AND_INVESTMENT_AUDIT.md` and stop on any mismatch with this plan
  - files: docs/EXCEL_OVERRIDE_AND_INVESTMENT_AUDIT.md
  - run: N/A (manual audit artifact update allowed)
  - evidence: commit:<hash> | run:<cmd> -> <result> | files:<actual changed paths> | docs:<hash or N/A> | status: clean
