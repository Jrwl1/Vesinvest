# Sprint

Window: 2026-03-20 to 2026-06-20

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
HUMANAUDIT session policy: `HUMANAUDIT` is a read-only intake lane for screenshot/text audits. The session persists across user messages until `OK GO`, `CANCEL`, or an explicit switch to another protocol.
OK GO handoff policy: `OK GO` inside an active `HUMANAUDIT` session freezes intake, merges related findings, and produces a proposed implementation plan in chat only; only a later `PLAN` run may write canonical planning docs or `docs/SPRINT.md`.
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

Tighten the login-to-step-3 setup experience without changing workflow truth: clarify the entry promise, stabilize VEETI search, move connected-state summary context into one persistent support rail, simplify the step-2 year-board hierarchy, restore chronological year ordering, make row editing reliable, and close with a fresh connected-workspace re-audit that includes a five-year import case.

## Recorded decisions (this sprint)

- `S-156` remains a deployment-only header-verification hold and must not block the new locally executable UI queue from becoming the current target.
- Customer workflow truth from the spec remains locked: VEETI connect, year import, explicit review/correction, planning-baseline creation, 20-year planning, and split depreciation must survive unchanged while the UI gets clearer and more stable.
- The step-2 board should answer `can I trust/import this year?` before it explains provenance internals, secondary metrics, or repair tooling.
- Parked or unselected years remain recoverable, but they should not consume the same primary board weight as currently selected or blocked years.
- Connected-state summary context belongs in one persistent support rail after VEETI link, not in duplicate bottom summary cards.
- Step-2 row editing should be forgiving: whole-row click targets, close-on-save behavior, and no tiny-target recovery loops after a save.
- Result warnings must use plain language and stay coherent with whatever the user just edited, whether the result stays explicitly stored or gains a derived preview.

---

| ID | Do | Files | Acceptance | Evidence | Stop | Status |
| --- | -- | ----- | ---------- | -------- | ---- | ------ |
| S-157 | Reframe login entry copy and sign-in chrome around the actual product job instead of step jargon. See S-157 substeps. | apps/web/src/components/LoginForm.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json, apps/web/src/components/LoginForm.test.tsx, apps/web/src/App.test.tsx, apps/web/src/context/DemoStatusContext.tsx | Login explains what Vesipolku is for in plain FI/SV/EN language, the right card does not repeat the sign-in action across multiple stacked phrases, and non-demo entry paths keep API/demo diagnostics clearly secondary. | Accepted via packets `a271313f1ceed33cdeb8e81b0a39ddc0514f4b15` and `dcadc07d92326000d18e2180860070decfd97c0a`; required web login/app/locale tests and web typecheck passed. | Stop if truthful login-entry wording or diagnostic demotion would require changing auth/demo runtime truth beyond the current frontend contract. | DONE |
| S-158 | Stabilize VEETI connect-step search and promote one persistent connected-state support rail after VEETI link. See S-158 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewOrchestration.ts, apps/web/src/v2/OverviewWizardPanels.tsx, apps/web/src/v2/OverviewSupportRail.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/**/*.test.tsx, apps/web/src/i18n/locales/*.json | VEETI search settles after typing stops without repeat flicker, and once an org is connected the user keeps one visible support rail through steps `2..6` on desktop with a sane mobile fallback instead of duplicate bottom summary cards. | Accepted via packets `768178a971c41dd17802d52d40449cd5c3d54d2f` and `3714f14be3f4456c258522d738be97aed891e687`; required Overview/AppShell/locale tests and web typecheck passed. | Stop if stable search or post-connect rail placement requires backend search-contract changes beyond the current `/v2/import/search` and connect-step semantics. | DONE |
| S-159 | Simplify the step-2 import board hierarchy, chronology, and parked-year treatment. See S-159 substeps. | apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/overviewLabels.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json | Visible year cards read chronologically left-to-right inside each lane, the missing-data warning stays primary, `Sekundära huvudtal` is replaced with plain pricing/volume language, and parked/unselected years move behind a secondary disclosure that still scales when five or more good VEETI years are present. | Packets `5fc52e8` and `fabb238` landed; row ready for REVIEW. | Stop if collapsing parked years or reordering cards breaks current imported-year state truth or makes five-year selection less recoverable than today. | READY |
| S-160 | Repair step-2 inline row editing so it behaves like a local card correction flow, not a sticky slab. See S-160 substeps. | apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/useOverviewManualPatchEditor.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx | The full finance row is clickable for edit, save closes the step-2 editor, and after saving one card the user can reopen the same or another year normally without relying on tiny value-chip targets. | Planned from HUMANAUDIT synthesis; execution evidence pending. | Stop if whole-row click or close-on-save behavior would require a broader draft-state model or would collapse current checkbox/action affordances into one ambiguous control surface. | TODO |
| S-161 | Make the result warning/signal truthful and understandable after inline financial edits. See S-161 substeps. | apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewManualForms.ts, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/**/*.test.ts, apps/web/src/v2/**/*.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/api/src/v2/**/*.spec.ts | The visible result row and its warning text stay coherent after inline finance edits, `/ 0` jargon is removed, and if `TilikaudenYliJaama` remains a separately stored field the UI makes that truth explicit instead of implying silent derivation. | Planned from HUMANAUDIT synthesis; execution evidence pending. | Stop if truthful result behavior requires a broader accounting-contract decision than the current manual-year patch seam can safely absorb. | TODO |
| S-162 | Close with focused wizard regressions and a connected-workspace re-audit that includes a five-year import case. See S-162 substeps. | apps/web/src/**, apps/api/src/v2/**, apps/api/src/veeti/**, apps/web/src/**/*.test.tsx, apps/api/src/**/*.spec.ts, docs/SETUP_WIZARD_UIUX_REAUDIT.md | Focused regressions plus a fresh connected-workspace live audit prove the login cleanup, VEETI search stabilization, support rail, chronological five-year board, parked-year disclosure, row-edit/save behavior, and result warning changes work without a new trust blocker, or record the blocker precisely. | Planned from HUMANAUDIT synthesis; execution evidence pending. | Stop if the re-audit still exposes a new trust or workflow gap outside `S-157..S-161`; record the blocker and stop there. | TODO |
| S-99 | Add the KVA selective-override contract and workbook provenance. See S-99 substeps. | apps/web/src/api.ts, apps/web/src/v2/**, apps/api/src/v2/**, apps/api/src/veeti/** | The product can represent VEETI baseline values, workbook candidate values, user-confirmed overrides, and a distinct workbook provenance on repaired historical years without falling back to generic manual provenance. | Accepted via packet evidence, focused web/api tests, and dual typecheck. | Stop if truthful selective override requires a broader historical-import rewrite beyond the current `v2/import/manual-year` and VEETI effective-data seams. | DONE |
| S-100 | Build the year-by-year workbook compare and confirmation flow for the six shared financial rows. See S-100 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/budgets/va-import/** | Users can upload one KVA workbook, see `2022`, `2023`, and `2024` matched against VEETI by year and canonical row, and explicitly choose whether to keep VEETI or apply workbook values before saving. | Accepted via parser packet, compare-UI packet, focused web/api tests, and typechecks. | Stop if the current workbook structure cannot be mapped deterministically from `KVA totalt` to years plus the six shared financial rows. | DONE |
| S-101 | Apply confirmed workbook overrides and repair the Kronoby years truthfully. See S-101 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/veeti/** | Confirmed workbook overrides persist and survive reload, Kronoby `2022` and `2023` budget sanity no longer mismatch due to missing `Material och tjanster`, and the repaired year cards show workbook provenance rather than generic manual edits. | Accepted via workbook batch-apply packet, focused web/api tests, and clean sync proof for 2022/2023. | Stop if the apply path requires a broader budget-generator or snapshot-schema rewrite outside the same feature slice. | DONE |
| S-102 | Make the 2024 merge between VEETI, KVA workbook, and statement PDF explicit. See S-102 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/veeti/** | For `2024`, the app can keep statement-PDF-backed finance values while workbook-confirmed line repairs such as `AineetJaPalvelut` remain explicit, and the year card explains the mixed-source ownership truthfully after reload. | Accepted via per-field provenance model, mixed-source UI readback, focused web/api tests, and typechecks. | Stop if truthful 2024 merge ownership cannot be represented without a broader per-field provenance model than this feature slice can safely add. | DONE |
| S-103 | Add an operator-friendly `Investointiohjelma` entry surface at the start of Ennuste. See S-103 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/api.ts, apps/api/src/v2/** | Before the denser Forecast workbenches, users get a clear `Investointiohjelma` surface with year, target, type, group, water EUR, wastewater EUR, total EUR, and note in utility language. | Accepted via packet `e4ba46c161cb4087f99e106eefa1ba140d41ff2d`, docs `616d09c`, focused web/api tests, and dual typecheck. | Stop if adding the entry surface requires replacing the existing Forecast architecture instead of layering a start surface ahead of it. | DONE |
| S-104 | Prefill `Poistosaannot` from the PTS workbook and connect them to the current depreciation engine. See S-104 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/api/src/v2/**, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts | PTS-derived investment groups and depreciation defaults appear as editable starting rules, map truthfully to the current scenario depreciation contract, and avoid internal-only jargon on the primary surface. | Accepted via packets `ded947ac70f7a7479ec3ad57bd644127fd74295e` and `44aa7a16bbf2a1e069ff6362675a0f39018ee4b7`, docs `88df84f`, focused web/api tests, locale integrity, and dual typecheck. | Stop if the PTS defaults cannot be represented truthfully by the current supported depreciation methods without adding unsupported contract types. | DONE |
| S-105 | Wire the investment-plan flow into depreciation, tariff, and cash impact views. See S-105 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts | Saved investment-plan inputs flow into yearly investments, depreciation preview, tariff pressure, and cash impact, and users can understand the effect without opening the full power-user workbench first. | Accepted via packets `4404cd67751a0db8b64330d8a1200ad783daf8a8` and `7fc77935161142607dd2d1737a67bb5cd0d7a003`, docs `79e5b50`, focused web/api tests, locale integrity, and dual typecheck. | Stop if the impact views require a broader Forecast compute-model rewrite beyond the current scenario/depreciation/investment seams. | DONE |
| S-106 | Close with focused regressions and a live Kronoby audit. See S-106 substeps. | apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts, docs/EXCEL_OVERRIDE_AND_INVESTMENT_AUDIT.md | Focused regressions pass, a wiped-workspace live audit covers Kronoby wipe, VEETI reconnect/import, workbook compare/apply, 2024 statement merge, and entry into `Investointiohjelma`, and the audit artifact ends with `whole sprint succeeded` or a blocker. | Accepted via packets `bd3c727032726be059c540720fb380f41c5962bc` and `0ae4d4fe0dc025dd4c716f558fd97cc746a147e0`, docs `5a4a000`, final regression suite, and the live audit artifact ending with `whole sprint succeeded`. | Stop if the available customer docs still leave one required source mapping untruthful in the live flow; record the blocker in the audit artifact and stop there. | DONE |
| S-107 | Make trial reset truly clean so a fresh tenant cannot reopen with stale mixed-source VEETI years. See S-107 substeps. | apps/api/src/demo/**, apps/api/src/trial/**, apps/api/src/v2/**, apps/api/src/v2/v2.service.spec.ts, apps/api/src/demo/demo-reset.service.ts | `POST /trial/reset-data` clears VEETI overrides and year policies alongside budgets, assumptions, snapshots, and link state, and a reconnect after reset no longer surfaces pre-existing mixed-source years such as `2024` workbook/PDF repairs. | Accepted via packet `c9ececf43645bd961d22dd3ed46a23f62a06808b`, docs `1b6b0e30d798bffb294dbe2d8f81750a245a5df4`, focused API regression, and live reset -> legal accept -> reconnect/import proof returning pure VEETI `2024` state with no manual overrides. | Stop if reset cleanup requires cross-tenant destructive behavior beyond the current org-scoped reset contract. | DONE |
| S-108 | Keep Step 3 review cards aligned with saved effective year data after `Save and sync year`. See S-108 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts | A sync-save of a manual year patch immediately updates the Step 3 review card to the same effective values returned by `GET /v2/import/years/:year/data`, without waiting for a hard reload or showing stale VEETI numbers. | Accepted via packet `764984e8b3b70b1ebf1fa07dd26146c31da73d13`, docs `8f539ea`, focused web regression for the audited stale-card path, and clean commit scope in `OverviewPageV2.tsx` plus `OverviewPageV2.test.tsx`. | Stop if truthful card refresh requires a broader Overview data-loading rewrite beyond the current year-cache and sync paths. | DONE |
| S-109 | Wire saved scenario `Poistosaannot` rules and year mappings into actual depreciation compute output. See S-109 substeps. | apps/api/src/projections/**, apps/api/src/v2/**, apps/api/src/v2/v2.service.spec.ts, apps/api/src/projections/projection-engine.spec.ts, apps/web/src/v2/EnnustePageV2.test.tsx | Saved class allocations and edited depreciation rules produce non-zero `investmentDepreciation` in computed scenario years, and the Forecast depreciation preview matches the API output. | Accepted via packets `a49c58900b9aa15a4a6941492476a90358fe52d5` and `378cc80a9c4b7e44ad67eef726084bd6ef21e83d`, docs `a7c6abb`, projection-service/engine regressions, V2 payload mapping proof, and Forecast UI preview assertions. | Stop if the current scenario contract cannot carry depreciation rules and class allocations into compute without a broader schema break. | DONE |
| S-110 | Make the primary Forecast funding signal capex-aware instead of over-trusting annual-result comfort. See S-110 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/api/src/v2/v2.service.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts | Capex-heavy scenarios surface cumulative-cash risk as the dominant funding warning when underfunding exists, while annual-result remains visible as a secondary operating signal and report summaries follow the same hierarchy. | Accepted via packets `1e108d4d2cf9c7e771ab10b33b0fe0c447fe8543` and `07e4ad2d377ae8e91b2ffac767bc840d1ce097dd`, docs `cb997ea`, focused Forecast/Reports regressions, locale integrity, and V2 report-summary regression proving cumulative-cash risk now owns the primary funding answer when peak-gap pressure exists. | Stop if fixing the funding hierarchy requires replacing the existing fee-sufficiency contract instead of reordering and clarifying the current dual-metric surfaces. | DONE |
| S-111 | Auto-map common investment groups into `Poistosaannot` defaults without hiding manual control. See S-111 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/** | Common groups such as `network`, `plant`, and `meters` prefill the obvious `Poistosaanto` mapping when confidence is high, while ambiguous groups stay manual and report readiness remains truthful. | Accepted via packets `e11cf5a339af43daf6c5bb91141cec223917c981` and `37bc2512c285867760cec77b68b3724266232f7e`, docs `8c544b2`, Forecast UI regressions for both high-confidence auto mapping and explicit unmapped fallback, and clean commit scope in `EnnustePageV2.tsx` plus `EnnustePageV2.test.tsx`. | Stop if deterministic aliasing would require unsafe guessing or unsupported cross-language fuzzy matching in the primary workflow. | DONE |
| S-112 | Close with regressions and a fresh live audit proving reset cleanliness, review-card truth, depreciation compute, and capex-aware funding signals. See S-112 substeps. | apps/web/src/v2/**, apps/api/src/v2/**, apps/api/src/projections/**, e2e/**, docs/ADVERSARIAL_AUDIT_2026-03-18.md | Focused regressions and a fresh wiped-workspace live audit prove that reset is clean, Step 3 cards match effective year data, mapped `Poistosaannot` affect computed depreciation, and large future capex changes the visible funding story truthfully enough for report preparation. | Accepted via packets `5006c123ccf7dc28c437d992516e2fc2dfbf7320` and `0e38019442f5a6839909224f2afdd1ec26bc942a`, docs `22a008e`, the full focused regression bundle, and the appended 2026-03-19 remediation audit showing fresh reset cleanliness, saved depreciation flow, and cumulative-cash-first capex pressure after a live 2030 stress injection. | Stop if a fresh live audit still exposes a trust gap that the current queue does not cover; record the blocker and stop there. | DONE |
| S-113 | Require explicit year approval in Step 3 and stop silent auto-review on `Continue`. See S-113 substeps. | apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/api.ts | Step 3 only marks a year reviewed after an explicit no-change approval or a save action on that year; `Continue` no longer silently promotes all `ready_for_review` years to reviewed. | Accepted via packet `a2f05eb8be9aa70f3f09604bc79e1ee3e1d5b330`, docs `review: evidence update`, focused web regressions for explicit approval and `Continue` routing, and clean web typecheck. | Stop if truthful approval state requires a larger V2 import/review contract change than the current wizard surface can safely absorb. | DONE |
| S-114 | Tighten wizard readiness and planning-baseline truth around canon finance rows. See S-114 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/veeti/** | Years missing canon finance rows such as `Material och tjanster` render as `needs attention`, cannot be treated as reviewed by summary flow, and cannot enter the planning baseline until corrected or excluded. | Accepted via packet `69c3e6451609f5a9ac14594c619c7080650b0e84`, docs `review: evidence update`, focused web regressions for missing canon rows, API regression pass, and clean dual typecheck. | Stop if customer-source row truth conflicts with the current canon-row contract and cannot be resolved by canonical order. | DONE |
| S-115 | Clean mixed-language fallback and stale helper copy across wizard, Forecast, and Reports. See S-115 substeps. | apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/components/** | Primary Swedish/Finnish/English surfaces no longer leak fallback strings from other locales, and helper/empty-state copy reflects the actual screen state instead of stale onboarding text. | Accepted via packet `c8d8d00837ed32b5eb50c516fc7914c7a361297d`, docs `review: evidence update`, focused wizard/Forecast/Reports regressions, locale integrity, and clean web typecheck. | Stop if locale parity requires a broader i18n migration outside the active V2 flow. | DONE |
| S-116 | Smooth the baseline-to-Ennuste handoff into a clearer first-scenario finance flow. See S-116 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/** | After baseline creation, the user reaches Forecast through an obvious first-scenario path with less empty-shelf friction and a clearer next finance task. | Accepted via packet `6d146eb567e2f5d0956d16d23c065d469586619e`, docs `review: evidence update`, focused Forecast/Overview regressions, API regression pass, and clean dual typecheck. | Stop if a truthful handoff requires hidden auto-creation that conflicts with the current scenario lifecycle contract. | DONE |
| S-117 | Add CFO-facing default depreciation assistance and explicit carry-forward mapping for future investments. See S-117 substeps. | apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/projections/** | Future investment years can use an explicit default/carry-forward depreciation mapping path, while ambiguous years stay manual and report readiness remains truthful. | Accepted via packets `cbb267786d6b84d9511c2b90264c6ed890e1a319` and `1cd7e7b06c8ad7c39c95fb74bb61274033985264`, docs `review: evidence update`, focused Forecast + locale regressions, API regression pass, and clean typecheck gates. | Stop if defaults or carry-forward would hide unsupported guessing instead of explicit user-controlled mapping. | DONE |
| S-118 | Simplify the `Poistosaannot` workbench and prove rule edits change forecast output in a user-defensible way. See S-118 substeps. | apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/api/src/v2/**, apps/api/src/projections/** | Users can see baseline depreciation, new-investment depreciation, total depreciation, tariff pressure, and cash impact while editing mappings/rules, and changing straight-line/residual/custom schedule visibly changes computed years. | Accepted via packets `90f0fd5aff2d439c8e5a69d9cd69d5a5101a0e36` and `d93c79e3955bb4c5e8eb036bcfdca535bab87b44`, docs `review: evidence update`, focused Forecast + locale regressions, engine/API/UI depreciation proof, and clean dual typecheck. | Stop if the current compute contract cannot surface edited rule impact without a broader schema break. | DONE |
| S-119 | Fix Reports/Forecast polish gaps that still undermine trust and accessibility. See S-119 substeps. | apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/v2/v2.css, apps/web/src/v2/*.test.tsx | Reports no longer shows first-report empty-state copy when reports exist, Forecast/Reports hierarchy is cleaner, and the live duplicate-form-field warning is removed or reduced to zero in the audited flow. | Accepted via packets `a5e4f746daf8955de3cfa384b830fe9025260dab` and `6a18506789a16506d08b6b2159a14ba18b44d76b`, docs `review: evidence update`, focused Forecast/Reports regressions, clean web typecheck, and a clean current-page browser console check after auth reload. | Stop if the live accessibility warning cannot be reproduced under repo-controlled state or lies outside the active V2 surfaces. | DONE |
| S-120 | Close with focused regressions and a full CFO reset-to-PDF live audit. See S-120 substeps. | apps/web/src/v2/**, apps/api/src/v2/**, apps/api/src/projections/**, docs/CFO_END_TO_END_AUDIT_2026-03-19.md | A fresh reset -> connect -> import -> review -> baseline -> forecast -> report audit proves a CFO can use the product end to end without an obvious trust, hierarchy, or localization blocker, or records the blocker precisely. | Accepted via packets `b194f233511592123edc93fabb61c05c4834473b` and `5bf0c0fadd7015c25bc75ad26f0e10d6a08b217f`, docs `review: evidence update`, the focused regression bundle, the live reset-to-PDF audit artifact, and final report/PDF network proof. | Stop if a fresh live audit still exposes a trust gap that the current queue does not cover; record the blocker and stop there. | DONE |
| S-121 | Reset the shared visual system, shell chrome, and status language across the V2 app. See S-121 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/App.css, apps/web/src/components/** | Overview, Forecast, and Reports share one stronger visual system for typography, surfaces, nav, status chips, and account chrome without changing current tab lock or backend-driven state truth. | packet:7f420fca794d8b86ece1f9bd442165e47cc8a4c7 | run:web shell tests + typecheck -> PASS | docs:f411087f5ec75d13c69a56209350f3424bb27253 | review:PASS | status: clean | Stop if the new shell requires route/state changes beyond the current `AppShellV2` contract. | DONE |
| S-122 | Rebuild login and shared entry states into the new trust-first visual system. See S-122 substeps. | apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/components/LoginForm.tsx, apps/web/src/components/InviteAcceptForm.tsx, apps/web/src/components/LegalAcceptanceGate.tsx, apps/web/src/components/*.test.tsx | Login, loading, error, invite, and legal-gate surfaces feel like one premium workspace entry while preserving current auth, demo, and legal-unlock behavior. | packet:c7707aa294d2b93ef42a4d77678d69d6639b8473 | run:login test + typecheck -> PASS | docs:db886825ccd19a8860b1f32fe1ccee262b9e92c4 | review:PASS | status: clean | Stop if the new entry surfaces require auth-flow changes beyond the current frontend contract. | DONE |
| S-123 | Redesign the Overview pending-review flow into an action-first review desk. See S-123 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx | The active Overview step leads with the real task, duplicated helper chrome is reduced, and explicit approval/provenance/readiness truth stays primary in pending-review states. | packet:955932c4e7c3017f97e140f03334b547e1602ef1 | run:overview test + locale integrity + typecheck -> PASS | docs:f2c79b70f3a9fa6685e0aa3c2eb5aac4592adae8 | review:PASS | status: clean | Stop if the new Overview hierarchy requires changing the current step contract instead of re-composing the existing surface. | DONE |
| S-124 | Add the baseline-ready / accepted-years Overview state and stronger year-ledger presentation. See S-124 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts | The first tab remains useful after setup completion: five good imported years can read as accepted, VEETI-imported, manually fulfilled, and ready for Forecast without hiding provenance or acceptance truth. | packet:f088e52dd5cf88941d5b0336b422d4275758a79a | run:overview accepted-state tests + typecheck -> PASS | docs:3c21a0d1987b9a1cf46679e60065c59654a1bdf2 | review:PASS | status: clean | Stop if the accepted-years state cannot be made truthful with the current Overview/year-review model. | DONE |
| S-125 | Rebuild Forecast into a chart-first cockpit while preserving current backend-driven gates. See S-125 substeps. | apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx | Forecast becomes visually chart-first and executive-first, while compute freshness, investment-program entry, depreciation visibility, and report-readiness gating remain explicit and truthful. | packet:fce37b156a4931b774efd6ceb2ae578d53e33ed3 | run:forecast test + locale integrity + typecheck -> PASS | docs:33cd78608c944fcb9ac2ccc72a7b7294051caad8 | review:PASS | status: clean | Stop if the new Forecast composition requires changing the current scenario/depreciation/report contract instead of the UI only. | DONE |
| S-126 | Rebuild Reports into a ledger + document-preview workspace without losing snapshot truth. See S-126 substeps. | apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/ReportsPageV2.test.tsx | Reports feels like a final board-ready document workspace while variant, provenance, readiness, and export state remain visible and correct. | packet:4b5036b8b76a71878aa62866f2d72c9a1f070811 | run:reports test + locale integrity + typecheck -> PASS | docs:29c778d19c67b9a204285515c480ba6904d724d2 | review:PASS | status: clean | Stop if document-grade framing requires changing the current report snapshot/export contract instead of the surface layer only. | DONE |
| S-127 | Close with responsive/accessibility/locale polish and a new live UI audit. See S-127 substeps. | apps/web/src/**, apps/web/src/i18n/locales/*.json, apps/web/src/App.css, apps/web/src/v2/v2.css, docs/FRONTEND_OVERHAUL_FINAL_AUDIT.md | The redesigned flow passes focused web regressions and a fresh live browser audit from login through Overview, Forecast, and Reports with no obvious trust, hierarchy, responsiveness, or locale blocker. | packet:814f1f514b79a7446276caa171420092e4a276bb | run:full web redesign bundle + typecheck -> PASS | docs:1745ca0fb1d51c07be174d1655122c0863cbcba9 | review:PASS | status: clean | Stop if the redesign introduces unresolved accessibility or responsive regressions outside the active web scope. | DONE |
| S-128 | Refine login and shared entry surfaces into a more Vesipolku-specific, less generic workspace entry. See S-128 substeps. | apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/components/**, apps/web/src/i18n/locales/*.json, apps/web/src/components/*.test.tsx | Login, loading, error, invite, and legal-gate surfaces feel specific to Vesipolku, generic hero copy is removed or reduced, and API/demo environment info is demoted without changing auth, demo, or legal-unlock behavior. | packet:310948f8532366b0e2dbfcc1a15732f88973a515 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | docs:N/A | review:PASS | status: clean | Stop if the requested entry-state changes require auth-flow or backend-mode changes beyond the current frontend contract. | DONE |
| S-129 | Make the wizard shell action-first and reversible with explicit back navigation and no duplicated step wording. See S-129 substeps. | apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx | Every wizard step after step 1 has a visible back control, the active task sits above summary/helper chrome, and repeated step wording is removed without breaking setup truth, tab locks, or route handling. | packet:d9e816f9c786696e295be9651caa707cedb58a25 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | docs:N/A | review:PASS | status: clean | Stop if back-step behavior requires a broader route/state rewrite beyond the current `AppShellV2` and Overview wizard contract. | DONE |
| S-130 | Speed up and simplify step-1 utility lookup/connect, including direct numeric/ID lookup and a lighter post-connect handoff. See S-130 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/veeti/**, apps/api/src/v2/**, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/**/*.spec.ts, apps/api/src/veeti/**/*.spec.ts | Common numeric, Y-tunnus, and name lookups resolve predictably, step-1 search/connect feels materially lighter, and the selected utility plus next task appear before slower secondary refresh work completes. | packet:df82ecd9ed34ef86e9a3bc016c4f6d6a7adf40f8 | run:pnpm --filter ./apps/api test -- src/veeti/veeti.service.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | docs:N/A | review:PASS | status: clean | Stop if search/connect speed requires changing the upstream VEETI contract instead of the current lookup, caching, and handoff strategy. | DONE |
| S-131 | Rebuild step-2 year intake into explicit selectable, suspicious, blocked, and parked states with warning-first missing-value treatment. See S-131 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts | Step 2 clearly separates selectable, suspicious, blocked, and parked years, main-card missing finance rows and visible `Saknas` states read as warnings, and a user can intentionally move a year out of the current import and restore it later without confusing that state with planning exclusion. | packet:3818a0fbc119b1e83352e161cf59e53d4f48a5ac | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | docs:N/A | review:PASS | status: clean | Stop if truthful parked-year behavior requires persisting a new backend year-state contract rather than a bounded wizard-selection model. | DONE |
| S-132 | Replace detached step-2 year repair slabs with true in-place year-card editing and keyboard commit semantics. See S-132 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/api.ts, apps/api/src/v2/**, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/**/*.spec.ts | Step-2 year cards edit in place on the clicked row, `Enter` saves, `Escape` cancels, outside click does not silently discard dirty edits, and the old under-card editor slab no longer appears in step 2. | packet:5d20f6b3b465568d59ae177bd3226e3ffc80e3f5 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | docs:N/A | review:PASS | status: clean | Stop if row-level in-place editing cannot reuse the current manual year patch contract and would require a broader draft-state or schema rewrite. | DONE |
| S-133 | Use the same in-place year-card editing model in step 3 and replace abstract readiness chips with value-led review summaries. See S-133 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts | Step 3 no longer opens a detached correction slab, top review checks show concrete bokslut, price, and volume values, and reviewed vs needs-attention vs excluded states remain explicit while using the same card interaction model as step 2. | packet:4a136a79078785155b4cb233ea200461a739dde6 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | docs:N/A | review:PASS | status: clean | Stop if value-led review summaries require a broader year-data contract than the current Overview and year-review state can provide. | DONE |
| S-134 | Reduce first-open, post-login, and post-connect load cost by cutting non-essential blocking fetches and eager year-detail prefetch. See S-134 substeps. | apps/web/src/App.tsx, apps/web/src/context/DemoStatusContext.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/veeti/**, apps/api/src/v2/**, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/**/*.spec.ts, apps/api/src/veeti/**/*.spec.ts | First open, post-login, and post-connect surfaces stop blocking on non-essential data, eager year-detail prefetch is bounded or on demand, and local browser/network traces show lower wait on step-1 search/connect and Overview first load without hiding current truth states. | packet:288d1c8 + packet:e13f3bc | run:focused web/api gates + fresh browser timing -> PASS | docs:review: evidence update | review:PASS | status: clean | Stop if measurable improvement cannot be reached without schema changes or VEETI-side performance changes outside repo control. | DONE |
| S-135 | Close the login and wizard trust polish with literal copy, locale parity, responsive states, and keyboard-safe editing coverage. See S-135 substeps. | apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/components/*.test.tsx, apps/web/src/v2/*.test.tsx | FI, SV, and EN copy is literal and professional across login and wizard, keyboard/focus/responsive behavior around the new edit and navigation model is covered, and no mixed-language or silent-discard regression remains in the tested flows. | packet:ea913cf + packet:b9a484d | run:focused web regression bundle + typecheck -> PASS | docs:review: evidence update | review:PASS | status: clean | Stop if locale or accessibility correctness requires a broader cross-app i18n migration outside the active web scope. | DONE |
| S-136 | Close with focused regression proof and a live login-to-step-6 audit for the new interaction model. See S-136 substeps. | apps/web/src/**, apps/api/src/v2/**, apps/api/src/veeti/**, docs/SETUP_WIZARD_UIUX_REAUDIT.md | Focused regressions and a fresh live audit from login through step 6 and into Forecast/Reports prove the new login, back navigation, parked-year flow, warning states, in-place editing, `Enter`-save behavior, and load improvements work without an obvious trust or workflow blocker, or record the blocker precisely. | packet:db6899c + packet:196963e | run:focused web/api regression bundle + fresh 4174 live audit -> PASS | docs:review: evidence update | review:PASS | status: clean | Stop if the live audit still exposes a trust or interaction gap that the current queue does not cover; record the blocker and stop there. | DONE |
| S-137 | Finish true row-local editing on step-2 year cards. See S-137 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json | Clicking a value row in step 2 edits that row where it sits; the card does not grow a full all-fields editor slab under the year, and the user never leaves the card-local context to correct one number. | Accepted via packet `be97b7cd96dfff6d4ec8565c0f99e36c94f6808f`, docs `e712794`, focused Overview/locale regressions, and clean web typecheck. | Stop if true row-local editing cannot reuse the current manual year patch contract without introducing a broader draft-state model. | DONE |
| S-138 | Keep step-3 review and correction card-native and remove the remaining secondary review slab. See S-138 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/i18n/locales/*.json | `Öppna och granska` keeps the user on the same year card: review summaries, approve-as-is, and any correction affordances stay card-native instead of opening a second under-card review surface. | Accepted via packet `9bf4a8275922490f2e91510f6b824aaa18771e7c`, docs `b2132aa`, focused Overview/yearReview/locale regressions, and clean web typecheck. | Stop if removing the secondary review slab would collapse explicit approve vs edit truth into one ambiguous control surface. | DONE |
| S-139 | Make row save preserve the current step and avoid unnecessary full-step reloads after `manual-year` save. See S-139 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/**, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/**/*.spec.ts | Saving one changed row updates the current card and step with minimal refresh work, does not flash a full `Laddar översikt...` state, and does not jump the user farther in the wizard than the explicit action requires. | Accepted via packet `26922f40f1d01c2af7e9fa5ae5a219d4296475a5`, docs `ace94c1`, focused web+api regression coverage, and clean dual typecheck. | Stop if preserving local step context would make review-state transitions or provenance truth inconsistent with the current backend contract. | DONE |
| S-140 | Bound linked-workspace Overview prefetch to visible years and the active step. See S-140 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/api.ts, apps/api/src/veeti/**, apps/api/src/v2/**, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/veeti/**/*.spec.ts, apps/api/src/v2/**/*.spec.ts | Opening an already linked/imported workspace no longer fetches non-visible future-year detail payloads such as `2025` and `2026` when the visible step only needs imported or review-visible years, and browser-network evidence shows the reduced fetch set. | Accepted via packet `75b2467806a6ac2a4b9651c7a38d1d45937a7fe5`, docs `ec80274`, focused Overview/AppShell regression coverage, clean web typecheck, and linked-workspace browser verification proving only `2024`, `2023`, and `2022` year-detail fetches remained on reload. | Stop if the active-step-visible fetch set cannot be reduced without breaking current trust summaries or card editing. | DONE |
| S-141 | Demote login environment metadata and close with a linked-workspace residual audit. See S-141 substeps. | apps/web/src/components/LoginForm.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json, apps/web/src/components/LoginForm.test.tsx, docs/SETUP_WIZARD_UIUX_REAUDIT.md | Login keeps environment metadata clearly secondary to the sign-in task, and a fresh linked-workspace audit from login through step 3 and a saved edit verifies that the residual interaction issues are closed or records the blocker precisely. | Accepted via packets `f31ff4caaee0603575be943242619dd5561bdac1` and `19960c88aeab1e675eef4f9242676fb029a4ca7e`, docs `6ca24ef`, focused login/locale regression coverage, clean web typecheck, and the appended linked-workspace live audit ending with `whole residual queue succeeded`. | Stop if the linked-workspace audit still exposes a trust or interaction gap not covered by `S-137..S-141`; record the blocker and stop there. | DONE |
| S-142 | Extract pure OverviewPageV2 selectors, builders, and stateless helpers into dedicated V2 modules. See S-142 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/*.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts | `OverviewPageV2.tsx` no longer owns pure value builders, label helpers, year-priority selectors, or other stateless derivation logic that can live in dedicated V2 helper modules, and focused tests still pass with no behavior drift. | Accepted via packets `7b09893` and `cde9d6f`, focused web regressions, and clean web typecheck. | Stop if moving stateless logic out of the page exposes hidden mutation/state coupling that cannot be separated without changing accepted behavior. | DONE |
| S-143 | Extract overview/search/import orchestration and setup-state derivation into dedicated hooks. See S-143 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/*.ts | Search, connect, import, overview refresh, wizard-step derivation, and visible-year selection live in dedicated hooks/modules instead of the page body, while the current setup flow and route behavior remain unchanged. | Accepted via packets `efcbca2` and `737b73f`, focused Overview/AppShell regressions, and clean web typecheck. | Stop if the current page-level state graph cannot be extracted without introducing new route, auth, or API behavior changes beyond the refactor scope. | DONE |
| S-144 | Extract manual year patch and year-detail workflow state into dedicated hooks/modules. See S-144 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/*.ts | Inline edit state, dirty guards, save behavior, and statement/workbook/QDIS workflow coordination are owned by dedicated hooks/modules, and the accepted step-2/step-3 behaviors from `S-137..S-141` remain intact. | Accepted via packets `7873a85` and `c7adf37`, focused Overview/yearReview regressions, and clean web typecheck. | Stop if extraction would require changing the accepted manual patch contract or provenance behavior instead of only relocating page-owned orchestration. | DONE |
| S-145 | Split step 2 and step 3 UI into dedicated components and shared year-card pieces. See S-145 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/*.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts | Step-2 import board and step-3 review surfaces render through extracted components/shared year-card pieces rather than one monolithic page render tree, while row-local editing, card-native review, and visible warnings still behave the same. | Accepted via packets `3a62d62` and `2dc6392`, docs `20a433a`, focused `OverviewPageV2` + `yearReview` web regressions, and web typecheck. | Stop if the current accepted year-card behavior depends on page-local render coupling that cannot be separated without a broader UI redesign. | DONE |
| S-146 | Split step 1, baseline, handoff, and summary/support surfaces out of OverviewPageV2. See S-146 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/*.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx | The connect, baseline, handoff, and summary/support surfaces are extracted into dedicated components so the top-level page composes steps instead of rendering every section inline, with no route or gating drift. | Accepted via packets `bd97c20` and `a6aba41`, docs `bb5b755`, focused `OverviewPageV2` + `AppShellV2` web regressions, and web typecheck. | Stop if the summary/handoff surfaces depend on page-private state that cannot be cleanly threaded through extracted components without contract changes. | DONE |
| S-147 | Reduce OverviewPageV2 to a route-level orchestration shell and harden refactor-specific regression coverage. See S-147 substeps. | apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/components/*.test.tsx, apps/web/src/v2/*.ts, apps/web/src/v2/*.tsx | `OverviewPageV2.tsx` is materially smaller and primarily wires extracted hooks/components together, with focused regressions proving the refactor did not change accepted setup behavior. | Accepted via packets `d186478` and `48dda78`, docs `964390b`, the focused refactor regression bundle, and web typecheck. | Stop if the file cannot be reduced to an orchestration shell without unresolved duplication or state ownership conflicts across the extracted modules. | DONE |
| S-148 | Re-run focused setup regressions and a linked-workspace live audit for the refactored Overview flow. See S-148 substeps. | apps/web/src/v2/**, apps/web/src/components/**, apps/web/src/i18n/locales/*.json, docs/SETUP_WIZARD_UIUX_REAUDIT.md | Focused web regressions and a linked-workspace live audit prove the refactored Overview flow still behaves the same from login through step 3 save, baseline gating, and linked-workspace reload, or record the blocker precisely. | Accepted via packets `e29efc0` and `02dc65b`, docs `60321c0`, the focused web regression bundle, and the appended linked-workspace audit artifact. | Stop if the live audit finds a trust, routing, or interaction regression introduced by the refactor that the active queue does not already cover. | DONE |
| S-149 | Harden workbook and statement upload boundaries and replace or mitigate vulnerable parser paths. See S-149 substeps. | apps/api/src/v2/**, apps/api/src/budgets/va-import/**, apps/api/package.json, pnpm-lock.yaml, apps/api/src/**/*.spec.ts | Workbook and statement preview endpoints enforce strict upload bounds, reject malformed/unsupported files early, and no longer rely on known vulnerable upload/parser paths for untrusted input without a documented mitigation. | Accepted via packets `abe840d96579a7ac9d9dc57137426bfa38641a8a` and `eaf8ab663b7e960ebde7a61f93a6ce82a667ffdb`, focused API regressions, and clean API typecheck. | Stop if truthful workbook preview cannot be preserved after replacing or isolating the current parser stack without a broader import-contract rewrite. | DONE |
| S-150 | Fix trusted client IP derivation and move auth throttling to a production-safe shared or edge-backed contract. See S-150 substeps. | apps/api/src/auth/**, apps/api/src/main.ts, apps/api/package.json, apps/api/.env.example, apps/api/src/**/*.spec.ts, DEPLOYMENT.md, README.md | Login, demo-login, and invitation acceptance no longer key off spoofable forwarded headers, and production auth throttling is no longer only per-process memory without an explicit shared or edge-backed enforcement path. | Accepted via packets `1a469cc7e3e5216cb2bb73afed7d9cdef60ef349` and `172dd4af0e6a4c27ba054dfd50b1920ead694fca`, focused auth/app bootstrap regressions, and clean API typecheck. | Stop if the current production target cannot provide any safe shared limiter backend or verified edge-enforcement path; record the exact deployment dependency before stopping. | DONE |
| S-151 | Remove browser-shipped demo secrets and align runtime/docs around backend-owned demo gating. See S-151 substeps. | apps/web/src/api.ts, apps/api/src/auth/**, apps/web/.env.example, apps/api/.env.example, apps/web/src/**/*.test.tsx, README.md, DEPLOYMENT.md | No `VITE_*` demo secret remains in the client path, demo login stays explicit, and docs/env examples no longer describe browser-visible values as shared secrets. | Accepted via packets `82394d929bc38bc39a7c7bc9a3d1d6f6c7b142a1` and `78680995e2bd5de128b4f3ce40f9553b5717107f`, focused web regressions, and docs/env cleanup proof. | Stop if the chosen demo-access policy depends on external identity tooling that cannot be represented or documented from the repository side. | DONE |
| S-152 | Reduce per-request auth/legal query cost on authenticated API paths. See S-152 substeps. | apps/api/src/auth/**, apps/api/src/legal/**, apps/api/src/tenant/**, apps/api/src/health/**, apps/api/src/**/*.spec.ts | Authenticated request paths no longer perform write-heavy legal-document sync on every guard pass, and membership/legal checks become read-only or cached enough to materially reduce repeated Prisma work without weakening org or legal truth. | Accepted via packets `493c4cd41dc1a26f897c50a8b20e883b4b798f46` and `b989a06d3ac0270c8f18ffa3395720ee000f9d64`, focused auth/app bootstrap regressions, and clean API typecheck. | Stop if legal-version caching would invalidate acceptance-record correctness or require a broader compliance/data-ownership decision. | DONE |
| S-153 | Split OCR and PDF import code out of the default Overview load and prove on-demand loading. See S-153 substeps. | apps/web/src/v2/**, apps/web/src/App.tsx, apps/web/vite.config.ts, apps/web/src/**/*.test.tsx | Login and default Overview paths no longer include OCR/PDF worker code until the user opens the relevant import flow, and production-build plus browser-network proof show the heavier assets loading on demand only. | Accepted via packets `faf3c893b73322d5f74620415fd2e8c11a0054ca` and `916a4f0961ef713dbd7b7e07033c6da057318329`, focused Overview/AppShell regressions, production build output, and live network proof of on-demand OCR/PDF asset loading. | Stop if the current import UX depends on eager OCR/PDF module side effects that cannot be deferred without changing accepted behavior. | DONE |
| S-154 | Trim non-forecast initial bundle cost by keeping charts forecast-scoped and splitting auth/login CSS from workspace CSS. See S-154 substeps. | apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/vite.config.ts, apps/web/src/**/*.test.tsx | The login route ships auth-only chrome/CSS, `recharts` stays out of login and default Overview network paths, and the production build shows smaller non-forecast initial assets without route-state regressions. | Accepted via packets `b559c43d395d1f3ae1689369d817cad88ae3ce04` and `304261e0a1af1b68873555a2486317fed1b3af30`, focused AppShell/Forecast/Reports regressions, production build output, and live network proof that login/default Overview do not request the chart chunk. | Stop if the required bundle split would force a broader route or shell rewrite outside the current web scope. | DONE |
| S-155 | Make frontend production header policy and dependency/security release gates explicit and verifiable. See S-155 substeps. | DEPLOYMENT.md, README.md, docs/PROD_DEPLOY.md, package.json, scripts/**, infra/**, apps/web/index.html | The repository documents or configures the real production header policy and verification steps, and release gates explicitly cover reachable prod advisories plus upload-surface hardening evidence. | Accepted via packets `c87d672785deb9d9100e140882013e2592b0e67d` and `4df0ed15637d6b94077bb5cbd2dc3cddbe034071`; the repo now versions the frontend header policy, enforces header verification during deploy, and fail-closed release checks now include a clean prod audit plus upload-surface regressions. | Stop if the real frontend edge configuration lives entirely outside repo control and cannot be versioned or documented precisely from this workspace. | DONE |
| S-156 | Re-run focused regressions, production build checks, and a live security/performance audit after remediation. See S-156 substeps. | apps/web/src/**, apps/api/src/**, docs/SECURITY_PERFORMANCE_REAUDIT.md, package.json | Focused automated regressions, production build output, header verification, and a fresh live browser audit prove the queue removed the audit findings without workflow drift, or record the remaining blocker precisely. | Re-audit recorded in `docs/SECURITY_PERFORMANCE_REAUDIT.md`; the focused regression bundle passes, `pnpm audit --prod --json` is clean, and `pnpm release-check` passes. The remaining blocker is deployment-state only: the live frontend edge still does not emit the repo-defined header policy because deploy SSH access is unavailable from this workspace. | Stop if the re-audit still exposes a security or performance gap outside `S-149..S-155`; record the blocker and stop there. | READY |

### S-157 substeps

- [x] Replace the login hero and sign-in card copy with plain product/task language and remove repeated sign-in chrome across the card header
  - files: apps/web/src/components/LoginForm.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json, apps/web/src/components/LoginForm.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:a271313f1ceed33cdeb8e81b0a39ddc0514f4b15 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/components/LoginForm.test.tsx,apps/web/src/components/LoginForm.tsx,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json | docs:N/A | status: clean

- [ ] Demote or hide API/demo environment diagnostics on normal login paths while keeping explicit demo availability truth for demo-capable environments
- [x] Demote or hide API/demo environment diagnostics on normal login paths while keeping explicit demo availability truth for demo-capable environments
  - files: apps/web/src/components/LoginForm.tsx, apps/web/src/context/DemoStatusContext.tsx, apps/web/src/App.css, apps/web/src/App.test.tsx, apps/web/src/components/LoginForm.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:dcadc07d92326000d18e2180860070decfd97c0a | run:pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css,apps/web/src/components/LoginForm.test.tsx,apps/web/src/components/LoginForm.tsx,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json | docs:N/A | status: clean

### S-158 substeps

- [x] Stop VEETI auto-search from retriggering after typing or org-selection settles and prove the result list stops flickering after debounce
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewOrchestration.ts, apps/web/src/v2/OverviewWizardPanels.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:768178a971c41dd17802d52d40449cd5c3d54d2f | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Promote one connected-state support rail after VEETI link and remove duplicate bottom summary placement on desktop while keeping a sane mobile fallback
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewSupportRail.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:3714f1407ba8721cdc1c2772e4133b59f0fdd6ab | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/OverviewSupportRail.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-159 substeps

- [x] Render step-2 year cards chronologically within each lane and keep five-year import cases readable without newest-to-oldest reading order
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:5fc52e83fb4a538c977ee2872d808ff77d138c4f | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewImportBoard.tsx,apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

- [x] Collapse parked or unselected years into a secondary disclosure and quiet the lower price/volume section with plain-language labels instead of `Sekundära huvudtal`
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/useOverviewSetupState.ts, apps/web/src/v2/overviewLabels.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:fabb23881d7b840773e1c2fcfdb301b5dfe48286 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewImportBoard.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-160 substeps

- [ ] Make the full step-2 finance row clickable for inline edit instead of limiting entry to the numeric value button
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: TBD

- [ ] Close the step-2 inline editor on save and keep same-card/other-card reopen behavior reliable without tiny-target recovery paths
  - files: apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/useOverviewManualPatchEditor.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: TBD

### S-161 substeps

- [ ] Replace `/ 0` result jargon with plain warning copy and keep the visible result signal coherent after inline financial edits
  - files: apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: TBD

- [ ] If `TilikaudenYliJaama` remains a separately stored field, make that truth explicit across summary/build warning paths and cover it with web/api regression proof
  - files: apps/web/src/v2/overviewManualForms.ts, apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewImportBoard.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/dto/manual-year-completion.dto.ts, apps/web/src/v2/**/*.test.ts, apps/web/src/v2/**/*.test.tsx, apps/api/src/v2/**/*.spec.ts, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/yearReview.test.ts src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: TBD

### S-162 substeps

- [ ] Run the focused login + wizard regression bundle for the new entry copy, support rail, chronology, parked-year, search, and row-edit behavior
  - files: apps/web/src/components/**, apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/**/*.test.tsx, apps/api/src/**/*.spec.ts
  - run: pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: TBD

- [ ] Re-run a connected-workspace live audit through VEETI connect, year import, five-year selection/recovery, row edit/save, and baseline context, and record whether the queue succeeded or stopped on a blocker in `docs/SETUP_WIZARD_UIUX_REAUDIT.md`
  - files: apps/web/src/**, apps/api/src/v2/**, apps/api/src/veeti/**, docs/SETUP_WIZARD_UIUX_REAUDIT.md
  - run: N/A (manual browser audit allowed)
  - evidence: TBD

### S-149 substeps

- [x] Add strict upload limits and early content checks to workbook and statement preview endpoints
  - files: apps/api/src/v2/**, apps/api/src/**/*.spec.ts, apps/api/package.json, pnpm-lock.yaml
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/auth/auth.controller.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:abe840d96579a7ac9d9dc57137426bfa38641a8a | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/auth/auth.controller.spec.ts && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.controller.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts | docs:N/A | status: clean

- [x] Replace, isolate, or explicitly mitigate the current vulnerable workbook parser path used for untrusted uploads
  - files: apps/api/src/budgets/va-import/**, apps/api/src/v2/**, apps/api/package.json, pnpm-lock.yaml, apps/api/src/**/*.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:eaf8ab663b7e960ebde7a61f93a6ce82a667ffdb | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/package.json,apps/api/src/budgets/va-import/kva-workbook-preview.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,pnpm-lock.yaml | docs:N/A | status: clean

### S-150 substeps

- [x] Replace manual forwarded-header IP parsing with trusted proxy-aware request identity for auth throttling
  - files: apps/api/src/auth/**, apps/api/src/main.ts, apps/api/src/**/*.spec.ts
  - run: pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:1a469cc7e3e5216cb2bb73afed7d9cdef60ef349 | run:pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/auth/auth.controller.spec.ts,apps/api/src/auth/auth.controller.ts,apps/api/src/main.ts | docs:N/A | status: clean

- [x] Move login, demo-login, and invitation throttling to a shared or edge-backed production contract and document the deployment requirement
  - files: apps/api/src/auth/**, apps/api/.env.example, apps/api/package.json, DEPLOYMENT.md, README.md, apps/api/src/**/*.spec.ts
  - run: pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:172dd4af0e6a4c27ba054dfd50b1920ead694fca | run:pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/api typecheck -> PASS | files:DEPLOYMENT.md,README.md,apps/api/.env.example,apps/api/src/auth/auth.controller.spec.ts,apps/api/src/auth/auth.controller.ts,apps/api/src/auth/rate-limit-contract.ts,apps/api/src/main.ts | docs:N/A | status: clean

### S-151 substeps

- [x] Remove `VITE_DEMO_KEY` usage from the browser path and keep demo gating backend-owned
  - files: apps/web/src/api.ts, apps/api/src/auth/**, apps/web/src/**/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/App.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:82394d929bc38bc39a7c7bc9a3d1d6f6c7b142a1 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/App.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/auth/auth.controller.ts,apps/web/src/App.test.tsx,apps/web/src/api.ts | docs:N/A | status: clean

- [x] Align env examples and product docs so no browser-visible demo value is described as a shared secret
  - files: apps/web/.env.example, apps/api/.env.example, README.md, DEPLOYMENT.md
  - run: N/A (docs and env example verification)
  - evidence: packet:78680995e2bd5de128b4f3ce40f9553b5717107f | run:N/A (docs and env example verification) -> PASS | files:DEPLOYMENT.md,README.md,apps/api/.env.example,apps/web/.env.example | docs:N/A | status: clean

### S-152 substeps

- [x] Remove write-heavy legal document synchronization from hot authenticated guard paths
  - files: apps/api/src/legal/**, apps/api/src/tenant/**, apps/api/src/auth/**, apps/api/src/**/*.spec.ts
  - run: pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:493c4cd41dc1a26f897c50a8b20e883b4b798f46 | run:pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/legal/legal.service.ts | docs:N/A | status: clean

- [x] Collapse or cache repeated membership and legal-acceptance checks so authenticated requests do less duplicate Prisma work
  - files: apps/api/src/auth/**, apps/api/src/legal/**, apps/api/src/tenant/**, apps/api/src/health/**, apps/api/src/**/*.spec.ts
  - run: pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:b989a06d3ac0270c8f18ffa3395720ee000f9d64 | run:pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/auth/jwt.strategy.ts,apps/api/src/legal/legal.service.ts | docs:N/A | status: clean

### S-153 substeps

- [x] Move statement OCR and QDIS PDF import helpers behind on-demand imports instead of default Overview module imports
  - files: apps/web/src/v2/**, apps/web/src/**/*.test.tsx, apps/web/vite.config.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:faf3c893b73322d5f74620415fd2e8c11a0054ca | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/overviewImportWorkflows.ts | docs:N/A | status: clean

- [x] Prove with production build output and browser network inspection that OCR/PDF worker assets load only when the import flow is opened
  - files: apps/web/src/v2/**, package.json
  - run: pnpm --filter ./apps/web build
  - evidence: packet:916a4f0961ef713dbd7b7e07033c6da057318329 | run:pnpm --filter ./apps/web build -> PASS (dist emitted dedicated `statementOcr` and `qdisPdfImport` chunks; live `http://127.0.0.1:4173` network trace kept OCR/PDF assets out of login + authenticated Overview requests 1-59, then loaded `statementOcr.ts`, `pdfjs-dist`, `pdf.worker.min.mjs`, `tesseract.js`, and `/vendor/tesseract/*` only after a statement PDF was selected) | files:apps/web/src/v2/overviewImportWorkflows.ts | docs:N/A | status: clean

### S-154 substeps

- [x] Split auth/login CSS from workspace CSS so the unauthenticated route does not ship the full V2 shell styling by default
  - files: apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/v2/v2.css, apps/web/src/**/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:b559c43d395d1f3ae1689369d817cad88ae3ce04 | run:pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.tsx | docs:N/A | status: clean

- [x] Keep charting forecast-scoped and prove login/default Overview paths do not pull `recharts` on first load
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/vite.config.ts, apps/web/src/**/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web build
  - evidence: packet:304261e0a1af1b68873555a2486317fed1b3af30 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web build -> PASS (sequential rerun after same-package test drift fix) | files:apps/web/src/v2/AppShellV2.tsx,apps/web/src/v2/EnnustePageV2.test.tsx | docs:N/A | status: clean

### S-155 substeps

- [x] Make the real production frontend header policy explicit in repo-visible docs/config and add a reproducible verification path
  - files: DEPLOYMENT.md, README.md, docs/PROD_DEPLOY.md, infra/**, apps/web/index.html
  - run: N/A (curl/header verification path and config/doc review)
  - evidence: packet:c87d672785deb9d9100e140882013e2592b0e67d | run:N/A (curl/header verification path and config/doc review) -> PASS | files:DEPLOYMENT.md,docs/PROD_DEPLOY.md,infra/nginx/vesipolku.frontend-headers.conf | docs:N/A | status: clean

- [x] Add reachable-production dependency and upload-surface security checks to the release gate flow
  - files: package.json, DEPLOYMENT.md, TESTING.md, scripts/**, apps/api/package.json, pnpm-lock.yaml
  - run: pnpm audit --prod --json
  - evidence: packet:4df0ed15637d6b94077bb5cbd2dc3cddbe034071 | run:pnpm audit --prod --json -> FAIL (gate now explicit; JSON surfaced remaining prod advisories on `multer@2.0.2`, `file-type@20.4.1`, and transitive `minimatch@3.1.2` under `exceljs`) | files:DEPLOYMENT.md,TESTING.md,apps/api/package.json,package.json | docs:N/A | status: clean

### S-156 substeps

- [x] Run the focused automated regression bundle after the security/performance fixes land
  - files: apps/web/src/**, apps/api/src/**, package.json
  - run: pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts src/v2/v2.service.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:a133713e36f45a2e5f3a76ca5c65bbbb7a09e401 | run:pnpm --filter ./apps/web test -- src/App.test.tsx src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/auth/auth.controller.spec.ts src/v2/v2.service.spec.ts test/app.module.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:package.json | docs:N/A | status: clean

- [x] Record a fresh live security/performance re-audit with build output, header checks, browser network/console proof, and any residual blockers
  - files: docs/SECURITY_PERFORMANCE_REAUDIT.md, apps/web/src/**, apps/api/src/**
  - run: N/A (manual browser audit plus build/header verification allowed)
  - evidence: packet:6eef7a43a126f183c2486060d9e1a97d52e57860 | run:N/A (manual browser audit plus build/header verification allowed) -> PASS with residual blockers recorded in docs/SECURITY_PERFORMANCE_REAUDIT.md | files:docs/SECURITY_PERFORMANCE_REAUDIT.md | docs:N/A | status: clean

### S-113 substeps

- [x] Add explicit no-change approval for technically ready years and keep `Continue` from auto-marking them reviewed
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:a2f05eb8be9aa70f3f09604bc79e1ee3e1d5b330 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/yearReview.test.ts,apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

- [x] Add regression proof that `Continue` opens the next unresolved review/baseline step without silently changing review state
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:a2f05eb8be9aa70f3f09604bc79e1ee3e1d5b330 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/yearReview.test.ts,apps/web/src/v2/yearReview.ts | docs:N/A | status: clean

### S-114 substeps

- [x] Tighten wizard year-status logic so missing canon finance rows force `needs attention` even when VEETI dataset presence looks technically ready
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/yearReview.ts, apps/web/src/api.ts, apps/api/src/v2/**, apps/api/src/veeti/**
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:69c3e6451609f5a9ac14594c619c7080650b0e84 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | baseline:absorbed | status: clean

- [x] Add proof that planning-baseline creation excludes unresolved years until the missing canon rows are corrected or the year is explicitly excluded
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/**, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: packet:69c3e6451609f5a9ac14594c619c7080650b0e84 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | baseline:absorbed | status: clean

### S-115 substeps

- [x] Remove mixed-language fallback and missing locale keys from wizard, Forecast, and Reports primary surfaces
  - files: apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/components/**
  - run: pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:c8d8d00837ed32b5eb50c516fc7914c7a361297d | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/ReportsPageV2.test.tsx,apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [x] Replace stale helper and empty-state copy with stateful wording on wizard and Reports headers
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:c8d8d00837ed32b5eb50c516fc7914c7a361297d | run:pnpm --filter ./apps/web test -- src/i18n/locales/localeIntegrity.test.ts src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/ReportsPageV2.test.tsx,apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

### S-116 substeps

- [x] Make the step-6 handoff and first Forecast landing tell the user exactly how to begin the first scenario instead of dropping into an empty shelf
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/api.ts, apps/api/src/v2/**
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:6d146eb567e2f5d0956d16d23c065d469586619e | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

- [x] Add regression proof for baseline-created -> open Forecast -> create/open first scenario without user-guessing dead ends
  - files: apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:6d146eb567e2f5d0956d16d23c065d469586619e | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

### S-117 substeps

- [x] Add an explicit default depreciation mapping path for future investment years, including a carry-forward option from the previous saved year
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/api.ts, apps/api/src/v2/**
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:cbb267786d6b84d9511c2b90264c6ed890e1a319 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | baseline:absorbed | status: clean

- [x] Keep ambiguous or unsupported investment years manual and preserve truthful report-readiness blocking until mappings are saved
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:1cd7e7b06c8ad7c39c95fb74bb61274033985264 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

### S-118 substeps

- [x] Simplify the `Poistosaannot` workbench language and status cues so rule editing, mapping completeness, and report readiness are understandable without internal jargon
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:90f0fd5aff2d439c8e5a69d9cd69d5a5101a0e36 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

- [x] Add engine/API/UI proof that edited straight-line, residual, and custom annual schedule rules change forecast depreciation and cash-pressure outputs visibly
  - files: apps/api/src/projections/**, apps/api/src/v2/**, apps/api/src/projections/projection-engine.spec.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: packet:d93c79e3955bb4c5e8eb036bcfdca535bab87b44 | run:pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/projections/projection-engine.spec.ts,apps/api/src/v2/v2.service.spec.ts,apps/web/src/v2/EnnustePageV2.test.tsx | docs:N/A | status: clean

### S-119 substeps

- [x] Remove misleading report-page empty-state/help copy and tighten Forecast/Reports hierarchy around current state
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/ReportsPageV2.test.tsx, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:a5e4f746daf8955de3cfa384b830fe9025260dab | run:pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/ReportsPageV2.test.tsx,apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

- [x] Reproduce and remove the live duplicate-form-field warning from the audited Forecast/Reports flow
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:6a18506789a16506d08b6b2159a14ba18b44d76b | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/ReportsPageV2.test.tsx | docs:N/A | status: clean

### S-120 substeps

- [x] Add a focused regression bundle for explicit year approval, tightened baseline gating, default depreciation mapping, and report-state truth
  - files: apps/web/src/v2/**, apps/api/src/v2/**, apps/api/src/projections/**, e2e/**
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:b194f233511592123edc93fabb61c05c4834473b | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

- [x] Re-run a full reset -> connect -> import -> review -> baseline -> forecast -> report live audit and record the outcome in a dedicated artifact
  - files: apps/web/src/v2/**, apps/api/src/v2/**, apps/api/src/projections/**, docs/CFO_END_TO_END_AUDIT_2026-03-19.md
  - run: N/A (manual browser audit allowed)
  - evidence: packet:5bf0c0fadd7015c25bc75ad26f0e10d6a08b217f | run:manual browser audit + focused web regression -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx,docs/CFO_END_TO_END_AUDIT_2026-03-19.md | docs:N/A | status: clean

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

- [x] Add the `Investointiohjelma` start surface ahead of the denser Forecast workbenches
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/api.ts, apps/api/src/v2/**
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:e4ba46c161cb4087f99e106eefa1ba140d41ff2d | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/dto/update-scenario.dto.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/riskScenario.test.ts,apps/web/src/v2/v2.css,docs/SPRINT.md | docs:e4ba46c161cb4087f99e106eefa1ba140d41ff2d | gate-fix:apps/web/src/v2/riskScenario.test.ts | status: clean

- [x] Use utility-language fields for year, target, type, group, water EUR, wastewater EUR, total EUR, and note instead of internal finance jargon
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/api.ts, apps/api/src/v2/**
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:e4ba46c161cb4087f99e106eefa1ba140d41ff2d | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/dto/update-scenario.dto.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/web/src/api.ts,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/riskScenario.test.ts,apps/web/src/v2/v2.css,docs/SPRINT.md | docs:e4ba46c161cb4087f99e106eefa1ba140d41ff2d | gate-fix:apps/web/src/v2/riskScenario.test.ts | status: clean

### S-104 substeps

- [x] Prefill investment groups and depreciation defaults from the PTS workbook and map them to the current supported depreciation methods
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:ded947ac70f7a7479ec3ad57bd644127fd74295e | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/pts-depreciation-defaults.ts,apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:ded947ac70f7a7479ec3ad57bd644127fd74295e | status: clean

- [x] Keep advanced internal terms secondary while the primary Ennuste entry uses `Poistosaannot`, `Poistotapa`, and `Poistoaika`
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:44aa7a16bbf2a1e069ff6362675a0f39018ee4b7 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:44aa7a16bbf2a1e069ff6362675a0f39018ee4b7 | status: clean

### S-105 substeps

- [x] Wire saved investment-plan entries into yearly investments, depreciation preview, tariff pressure, and cash impact
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/api/src/v2/**, apps/web/src/api.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:4404cd67751a0db8b64330d8a1200ad783daf8a8 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx,apps/web/src/v2/v2.css | docs:4404cd67751a0db8b64330d8a1200ad783daf8a8 | status: clean

- [x] Keep the start-of-Ennuste entry and the existing power-user workbenches aligned so users can continue into deeper edits without losing context
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:7fc77935161142607dd2d1737a67bb5cd0d7a003 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:7fc77935161142607dd2d1737a67bb5cd0d7a003 | status: clean

### S-106 substeps

- [x] Add final focused regressions for workbook compare/apply, 2024 statement merge, and `Investointiohjelma`
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/i18n/locales/localeIntegrity.test.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:bd3c727032726be059c540720fb380f41c5962bc | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx | docs:bd3c727032726be059c540720fb380f41c5962bc | status: clean

- [x] Run a wiped-workspace live audit for Kronoby covering wipe, reconnect/import, workbook repair, 2024 statement merge, and entry into `Investointiohjelma`
  - files: apps/web/src/v2/**, docs/EXCEL_OVERRIDE_AND_INVESTMENT_AUDIT.md
  - run: N/A (manual browser audit allowed)
  - evidence: packet:0ae4d4fe0dc025dd4c716f558fd97cc746a147e0 | run:manual browser audit -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/OverviewPageV2.test.tsx | docs:0ae4d4fe0dc025dd4c716f558fd97cc746a147e0 | status: clean

- [x] Record the explicit sprint outcome in `docs/EXCEL_OVERRIDE_AND_INVESTMENT_AUDIT.md` and stop on any mismatch with this plan
  - files: docs/EXCEL_OVERRIDE_AND_INVESTMENT_AUDIT.md
  - run: N/A (manual audit artifact update allowed)
  - evidence: packet:0ae4d4fe0dc025dd4c716f558fd97cc746a147e0 | run:manual browser audit -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/OverviewPageV2.test.tsx | docs:0ae4d4fe0dc025dd4c716f558fd97cc746a147e0 | status: clean

### S-107 substeps

- [x] Extend tenant reset so org-scoped trial/demo cleanup deletes VEETI overrides and year-policy rows alongside snapshots, budgets, and link state
  - files: apps/api/src/demo/**, apps/api/src/trial/**, apps/api/src/v2/**, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:c9ececf43645bd961d22dd3ed46a23f62a06808b | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/demo/demo-reset.service.spec.ts && pnpm --filter ./apps/api typecheck && live reset/reconnect check -> PASS | files:apps/api/src/demo/demo-reset.service.spec.ts,apps/api/src/demo/demo-reset.service.ts | docs:N/A | status: clean

- [x] Add regression proof that reset followed by reconnect returns pure VEETI `2024` state instead of stale workbook/PDF provenance
  - files: apps/api/src/demo/**, apps/api/src/trial/**, apps/api/src/v2/**, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:c9ececf43645bd961d22dd3ed46a23f62a06808b | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/demo/demo-reset.service.spec.ts && pnpm --filter ./apps/api typecheck && live reset/reconnect check -> PASS | files:apps/api/src/demo/demo-reset.service.spec.ts,apps/api/src/demo/demo-reset.service.ts | docs:N/A | status: clean

### S-108 substeps

- [x] Refresh `yearDataCache` for synced years after `Save and sync year` so Step 3 cards render current effective values without a hard reload
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/api.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:764984e8b3b70b1ebf1fa07dd26146c31da73d13 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add focused regression covering manual override -> sync-save -> immediate Step 3 card refresh for changed `materialsCosts` and `result`
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:764984e8b3b70b1ebf1fa07dd26146c31da73d13 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-109 substeps

- [x] Pass scenario depreciation rules into the subtotal compute path and preserve saved class allocations when building scenario output
  - files: apps/api/src/projections/**, apps/api/src/v2/**, apps/api/src/v2/v2.service.spec.ts, apps/api/src/projections/projection-engine.spec.ts
  - run: pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/api typecheck
  - evidence: packet:a49c58900b9aa15a4a6941492476a90358fe52d5 | run:pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts src/projections/projections.service.spec.ts && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/projections/projections.service.spec.ts,apps/api/src/projections/projections.service.ts | docs:N/A | status: clean

- [ ] Add regression proof that mapped investment years produce non-zero `investmentDepreciation` and edited useful life / residual settings change computed years
- [x] Add regression proof that mapped investment years produce non-zero `investmentDepreciation` and edited useful life / residual settings change computed years
  - files: apps/api/src/projections/projection-engine.spec.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: packet:378cc80a9c4b7e44ad67eef726084bd6ef21e83d | run:pnpm --filter ./apps/api test -- src/projections/projection-engine.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/projections/projection-engine.spec.ts,apps/api/src/v2/v2.service.spec.ts,apps/web/src/v2/EnnustePageV2.test.tsx | docs:N/A | status: clean

### S-110 substeps

- [x] Rework the primary Forecast funding card so capex-driven cumulative-cash underfunding becomes the dominant warning when it exists
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:1e108d4d2cf9c7e771ab10b33b0fe0c447fe8543 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

- [ ] Align report summaries and secondary fee-sufficiency surfaces so annual-result remains visible but no longer masquerades as the only funding answer
- [x] Align report summaries and secondary fee-sufficiency surfaces so annual-result remains visible but no longer masquerades as the only funding answer
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/ReportsPageV2.test.tsx, apps/api/src/v2/v2.service.ts, apps/api/src/v2/v2.service.spec.ts, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:07e4ad2d377ae8e91b2ffac767bc840d1ce097dd | run:pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts,apps/api/src/v2/v2.service.ts,apps/web/src/v2/ReportsPageV2.test.tsx,apps/web/src/v2/ReportsPageV2.tsx | docs:N/A | status: clean

### S-111 substeps

- [x] Add conservative alias mapping from common `Investointiohjelma` groups into scenario `Poistosaanto` defaults at the handoff to depreciation
  - files: apps/web/src/v2/**, apps/web/src/api.ts, apps/api/src/v2/**
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:e11cf5a339af43daf6c5bb91141cec223917c981 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx | docs:N/A | status: clean

- [ ] Keep ambiguous or low-confidence groups manual and add focused regression for both auto-mapped and unmapped cases
- [x] Keep ambiguous or low-confidence groups manual and add focused regression for both auto-mapped and unmapped cases
  - files: apps/web/src/v2/EnnustePageV2.test.tsx, apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:37bc2512c285867760cec77b68b3724266232f7e | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx | docs:N/A | status: clean

### S-112 substeps

- [x] Add the focused regression bundle for reset cleanliness, sync-save review truth, depreciation compute, and capex-aware funding hierarchy
  - files: apps/web/src/v2/**, apps/api/src/v2/**, apps/api/src/projections/**, e2e/**
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:5006c123ccf7dc28c437d992516e2fc2dfbf7320 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/projections/projection-engine.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/ReportsPageV2.test.tsx | docs:N/A | status: clean

- [ ] Re-run a wiped-workspace live audit for Kronoby covering reset, reconnect/import `2022..2026`, manual override sync-save, mapped depreciation, capex stress, and report readiness
- [x] Re-run a wiped-workspace live audit for Kronoby covering reset, reconnect/import `2022..2026`, manual override sync-save, mapped depreciation, capex stress, and report readiness
  - files: apps/web/src/v2/**, apps/api/src/v2/**, apps/api/src/projections/**, docs/ADVERSARIAL_AUDIT_2026-03-18.md
  - run: N/A (manual browser audit allowed)
  - evidence: packet:0e38019442f5a6839909224f2afdd1ec26bc942a | run:manual browser audit + live API cross-check -> PASS | files:docs/ADVERSARIAL_AUDIT_2026-03-18.md | docs:N/A | status: clean

### S-121 substeps

- [x] Define the new shared token palette, typography scale, surface tiers, and shell-level spacing system for the V2 app
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/App.css, apps/web/src/components/LanguageSwitcher.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/components/LanguageSwitcher.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:7f420fca794d8b86ece1f9bd442165e47cc8a4c7 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/components/LanguageSwitcher.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Apply the new shell, nav, account, and status-chip treatment without changing current tab-lock or workspace-truth logic
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/v2.css, apps/web/src/App.css, apps/web/src/components/LanguageSwitcher.tsx, apps/web/src/v2/AppShellV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/components/LanguageSwitcher.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:7f420fca794d8b86ece1f9bd442165e47cc8a4c7 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/components/LanguageSwitcher.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css,apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-122 substeps

- [x] Redesign login, loading, error, invite, and legal-gate states into one trust-first entry system
  - files: apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/components/LoginForm.tsx, apps/web/src/components/InviteAcceptForm.tsx, apps/web/src/components/LegalAcceptanceGate.tsx, apps/web/src/components/LoginForm.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:c7707aa294d2b93ef42a4d77678d69d6639b8473 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css,apps/web/src/components/InviteAcceptForm.tsx,apps/web/src/components/LegalAcceptanceGate.tsx,apps/web/src/components/LoginForm.tsx | docs:N/A | status: clean

- [x] Align auth/demo status messaging and CTA hierarchy with the new entry layout while keeping current behavior unchanged
  - files: apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/components/LoginForm.tsx, apps/web/src/components/InviteAcceptForm.tsx, apps/web/src/components/LegalAcceptanceGate.tsx, apps/web/src/components/LoginForm.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:c7707aa294d2b93ef42a4d77678d69d6639b8473 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css,apps/web/src/components/InviteAcceptForm.tsx,apps/web/src/components/LegalAcceptanceGate.tsx,apps/web/src/components/LoginForm.tsx | docs:N/A | status: clean

### S-123 substeps

- [x] Rebuild the Overview hero, summary, and step chrome so the active task leads in pending-review states
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:955932c4e7c3017f97e140f03334b547e1602ef1 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Keep explicit approval, provenance, and readiness language prominent while reducing duplicated helper chrome in Overview
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:955932c4e7c3017f97e140f03334b547e1602ef1 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-124 substeps

- [x] Implement the accepted-years / baseline-ready first-tab state so Overview remains useful after setup completion
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:f088e52dd5cf88941d5b0336b422d4275758a79a | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Present accepted imported years as a calm auditable ledger without hiding VEETI-imported and manually fulfilled truth
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:f088e52dd5cf88941d5b0336b422d4275758a79a | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-125 substeps

- [x] Restructure Forecast into a chart-first executive cockpit with a tighter scenario rail and preserved command/readiness strip
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:fce37b156a4931b774efd6ceb2ae578d53e33ed3 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Restyle the investment-program and depreciation workbenches to match the new visual system while keeping freshness, depreciation, and report gates explicit
  - files: apps/web/src/v2/EnnustePageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/EnnustePageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:fce37b156a4931b774efd6ceb2ae578d53e33ed3 | run:pnpm --filter ./apps/web test -- src/v2/EnnustePageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-126 substeps

- [x] Redesign Reports into a ledger + document-preview workspace without changing snapshot or export behavior
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:4b5036b8b76a71878aa62866f2d72c9a1f070811 | run:pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Keep report readiness, variant, provenance, and export state visually explicit in the redesigned Reports page
  - files: apps/web/src/v2/ReportsPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/api.ts, apps/web/src/i18n/locales/*.json, apps/web/src/v2/ReportsPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:4b5036b8b76a71878aa62866f2d72c9a1f070811 | run:pnpm --filter ./apps/web test -- src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-127 substeps

- [x] Close the focused redesigned-surface regression bundle and any responsive/accessibility polish needed for clean web gates
  - files: apps/web/src/**, apps/web/src/i18n/locales/*.json, apps/web/src/App.css, apps/web/src/v2/v2.css
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/components/LoginForm.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:814f1f514b79a7446276caa171420092e4a276bb | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/components/LoginForm.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/EnnustePageV2.test.tsx src/v2/ReportsPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx,docs/FRONTEND_OVERHAUL_FINAL_AUDIT.md | docs:N/A | status: clean

- [x] Run a live browser audit from login through accepted Overview, Forecast, Reports, and report export readiness, and record the result in `docs/FRONTEND_OVERHAUL_FINAL_AUDIT.md`
  - files: apps/web/src/**, docs/FRONTEND_OVERHAUL_FINAL_AUDIT.md
  - run: N/A (manual browser audit allowed)
  - evidence: packet:814f1f514b79a7446276caa171420092e4a276bb | run:manual browser audit -> PASS | files:apps/web/src/v2/EnnustePageV2.test.tsx,apps/web/src/v2/EnnustePageV2.tsx,docs/FRONTEND_OVERHAUL_FINAL_AUDIT.md | docs:N/A | status: clean

### S-128 substeps

- [x] Restyle the login and shared entry surfaces around a more Vesipolku-specific identity, quieter environment chrome, and shorter literal copy
  - files: apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/components/LoginForm.tsx, apps/web/src/components/InviteAcceptForm.tsx, apps/web/src/components/LegalAcceptanceGate.tsx, apps/web/src/i18n/locales/*.json, apps/web/src/components/LoginForm.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:310948f8532366b0e2dbfcc1a15732f88973a515 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css,apps/web/src/App.tsx,apps/web/src/components/InviteAcceptForm.tsx,apps/web/src/components/LegalAcceptanceGate.tsx,apps/web/src/components/LoginForm.tsx,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json | docs:N/A | status: clean

- [x] Keep invite, loading, error, and legal-gate entry states coherent under the same system without changing auth, demo, or legal-unlock behavior
  - files: apps/web/src/App.tsx, apps/web/src/App.css, apps/web/src/components/InviteAcceptForm.tsx, apps/web/src/components/LegalAcceptanceGate.tsx, apps/web/src/components/LoginForm.tsx, apps/web/src/components/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:310948f8532366b0e2dbfcc1a15732f88973a515 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css,apps/web/src/App.tsx,apps/web/src/components/InviteAcceptForm.tsx,apps/web/src/components/LegalAcceptanceGate.tsx,apps/web/src/components/LoginForm.tsx,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json | docs:N/A | status: clean

### S-129 substeps

- [x] Add visible wizard back-step controls and deterministic previous-step resolution across the shell and setup surfaces
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:d9e816f9c786696e295be9651caa707cedb58a25 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/AppShellV2.test.tsx,apps/web/src/v2/AppShellV2.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/overviewWorkflow.ts,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Remove duplicated step wording and keep the active action surface above summary and helper chrome in steps 1 to 3
  - files: apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:d9e816f9c786696e295be9651caa707cedb58a25 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/AppShellV2.test.tsx,apps/web/src/v2/AppShellV2.tsx,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/overviewWorkflow.ts,apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-130 substeps

- [x] Add direct numeric-id, Y-tunnus, and name lookup behavior with regression proof for cold step-1 utility search
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/veeti/**, apps/api/src/v2/**, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/veeti/**/*.spec.ts, apps/api/src/v2/**/*.spec.ts
  - run: pnpm --filter ./apps/api test -- src/veeti/veeti.service.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck
  - evidence: packet:df82ecd9ed34ef86e9a3bc016c4f6d6a7adf40f8 | run:pnpm --filter ./apps/api test -- src/veeti/veeti.service.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts,apps/api/src/veeti/veeti.service.spec.ts,apps/api/src/veeti/veeti.service.ts,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Trim post-connect waiting so the selected utility and next task render before slower secondary Overview, scenario, and report refresh work completes
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/**, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/**/*.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:df82ecd9ed34ef86e9a3bc016c4f6d6a7adf40f8 | run:pnpm --filter ./apps/api test -- src/veeti/veeti.service.spec.ts src/v2/v2.service.spec.ts && pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api typecheck && pnpm --filter ./apps/web typecheck -> PASS | files:apps/api/src/v2/v2.service.spec.ts,apps/api/src/veeti/veeti.service.spec.ts,apps/api/src/veeti/veeti.service.ts,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-131 substeps

- [x] Add a separate parked-year state for `not in this import` and keep it distinct from blocked and excluded planning states
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:3818a0fbc119b1e83352e161cf59e53d4f48a5ac | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Rebuild step-2 lane visuals so missing main-row values and `Saknas` states use warning treatment and non-complete years are not presented as normal selectable candidates
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:3818a0fbc119b1e83352e161cf59e53d4f48a5ac | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-132 substeps

- [x] Replace the step-2 detached under-card editor slab with row-level in-place editing on the year card itself
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:5d20f6b3b465568d59ae177bd3226e3ffc80e3f5 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Wire `Enter`-save, `Escape`-cancel, dirty-state protection, and provenance-safe save behavior through the current manual year patch contract
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/**, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/**/*.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:5d20f6b3b465568d59ae177bd3226e3ffc80e3f5 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-133 substeps

- [x] Replace step-3 abstract `OK` readiness chips with concrete bokslut, price, and volume value summaries
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:4a136a79078785155b4cb233ea200461a739dde6 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Reuse the same in-place year-card correction model in step 3 and keep explicit approve and review actions separate from editing
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/i18n/locales/*.json, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:4a136a79078785155b4cb233ea200461a739dde6 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-134 substeps

- [x] Defer non-essential app bootstrap and Overview fetches so the current surface paints on the minimum truthful data set first
  - files: apps/web/src/App.tsx, apps/web/src/context/DemoStatusContext.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/**, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/**/*.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:288d1c842cbeecf35fbb99e88131f5b59c0cb3d5 | run:pnpm --filter ./apps/web test -- src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Bound or on-demand prefetch of per-year detail and record local browser timing for login, step-1 search/connect, and Overview first load
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/api.ts, apps/api/src/veeti/**, apps/api/src/v2/**
  - run: N/A (manual browser timing and network verification allowed)
  - evidence: packet:e13f3bcc6c19982ff2fb335ae0ce4846bd098abd | run:manual browser timing + network inspection -> PASS (fresh audit org `timing.audit.b@dev.local`: login screen 58 ms, login->step1 214 ms, search 201 ms, connect->step2 354 ms; bounded connect path fetched 4 year-detail payloads) | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-135 substeps

- [x] Rewrite login and wizard primary copy in FI, SV, and EN to literal professional task language and extend locale-integrity coverage for the changed keys
  - files: apps/web/src/App.tsx, apps/web/src/components/**, apps/web/src/v2/**, apps/web/src/i18n/locales/*.json, apps/web/src/components/*.test.tsx, apps/web/src/v2/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:ea913cf43b9cbeb257cc92df3b2eb86661115bec | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/components/LoginForm.test.tsx,apps/web/src/components/LoginForm.tsx,apps/web/src/i18n/locales/en.json,apps/web/src/i18n/locales/fi.json,apps/web/src/i18n/locales/localeIntegrity.test.ts,apps/web/src/i18n/locales/sv.json,apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

- [x] Add focused keyboard, focus, and responsive regression coverage for back navigation, parked-year flow, and the new in-place editing model
  - files: apps/web/src/v2/**, apps/web/src/App.css, apps/web/src/v2/v2.css, apps/web/src/v2/*.test.tsx, apps/web/src/components/*.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:b9a484d72a2d6a0f60fa6fe66957f0766849071e | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/components/LoginForm.test.tsx,apps/web/src/v2/AppShellV2.test.tsx,apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

### S-136 substeps

- [x] Run the focused regression bundle for login, shell, Overview and yearReview, and any added step-1 API lookup and loading coverage
  - files: apps/web/src/**, apps/api/src/v2/**, apps/api/src/veeti/**, apps/web/src/components/*.test.tsx, apps/web/src/v2/*.test.tsx, apps/api/src/v2/**/*.spec.ts, apps/api/src/veeti/**/*.spec.ts
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/veeti/veeti.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:db6899c2ac0d9dc258ae2832a3748bfd2953a867 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts src/veeti/veeti.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/api/src/veeti/veeti.service.spec.ts,apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Re-run a live audit from login through step 6 and into Forecast and Reports, and record whether the whole queue succeeded or stopped on a blocker in `docs/SETUP_WIZARD_UIUX_REAUDIT.md`
  - files: apps/web/src/**, apps/api/src/v2/**, apps/api/src/veeti/**, docs/SETUP_WIZARD_UIUX_REAUDIT.md
  - run: N/A (manual browser audit allowed)
  - evidence: packet:196963eb990b18eb3cac978c107707e1b7cf7d56 | run:manual browser audit -> PASS (fresh `4174` server: isolated org `timing.audit.c@dev.local` verified login/legal/search/connect/import; audit-ready `admin@vesipolku.dev` workspace verified explicit approvals, step 6, Forecast, and Reports) | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,docs/SETUP_WIZARD_UIUX_REAUDIT.md | docs:N/A | status: clean

### S-137 substeps

- [x] Replace the current step-2 all-fields under-card editor with true row-local editing for clicked canon rows
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:be97b7cd96dfff6d4ec8565c0f99e36c94f6808f | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

- [x] Keep one-row correction scoped to the clicked field while leaving the rest of the year card in read mode
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:be97b7cd96dfff6d4ec8565c0f99e36c94f6808f | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/v2.css | docs:N/A | status: clean

### S-138 substeps

- [x] Remove the remaining step-3 secondary review slab and keep approve or edit controls anchored to the card itself
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/v2.css, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:9bf4a8275922490f2e91510f6b824aaa18771e7c | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Keep explicit approve-as-is versus correction intent visible without creating a second stacked interaction surface
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:9bf4a8275922490f2e91510f6b824aaa18771e7c | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-139 substeps

- [x] Keep `Enter` row-save local by updating the current card and step without flashing a full Overview loading state
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:26922f40f1d01c2af7e9fa5ae5a219d4296475a5 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Preserve correct review-state and provenance updates while avoiding unnecessary `overview` and `context` reload churn after `manual-year` save
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/api/src/v2/**, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/v2/**/*.spec.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck
  - evidence: packet:26922f40f1d01c2af7e9fa5ae5a219d4296475a5 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/api test -- src/v2/v2.service.spec.ts && pnpm --filter ./apps/web typecheck && pnpm --filter ./apps/api typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-140 substeps

- [x] Restrict linked-workspace year-detail prefetch to imported or review-visible years for the active step
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/api.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:75b2467806a6ac2a4b9651c7a38d1d45937a7fe5 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add network-backed verification that already-linked workspaces no longer fetch non-visible future-year detail such as `2025` and `2026` on Overview open
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/api/src/veeti/**, apps/api/src/v2/**, apps/web/src/v2/OverviewPageV2.test.tsx, apps/api/src/veeti/**/*.spec.ts, apps/api/src/v2/**/*.spec.ts
  - run: N/A (manual browser network verification allowed)
  - evidence: packet:75b2467806a6ac2a4b9651c7a38d1d45937a7fe5 | run:manual browser network verification -> PASS (linked-workspace reload on `http://127.0.0.1:4173` fetched only `/years/2024/data`, `/years/2023/data`, and `/years/2022/data`; no `/years/2025/data` or `/years/2026/data`) | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-141 substeps

- [x] Demote login environment metadata below the sign-in task so API and demo info read as supporting context instead of primary chrome
  - files: apps/web/src/components/LoginForm.tsx, apps/web/src/App.css, apps/web/src/i18n/locales/*.json, apps/web/src/components/LoginForm.test.tsx
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:f31ff4caaee0603575be943242619dd5561bdac1 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/App.css,apps/web/src/components/LoginForm.test.tsx,apps/web/src/components/LoginForm.tsx | docs:N/A | status: clean

- [x] Re-run a linked-workspace live audit from login through step 3 and a saved edit, and record whether the residual queue succeeded or stopped on a blocker in `docs/SETUP_WIZARD_UIUX_REAUDIT.md`
  - files: apps/web/src/**, apps/api/src/v2/**, apps/api/src/veeti/**, docs/SETUP_WIZARD_UIUX_REAUDIT.md
  - run: N/A (manual browser audit allowed)
  - evidence: packet:19960c88aeab1e675eef4f9242676fb029a4ca7e | run:manual browser audit -> PASS (login metadata stayed below the sign-in form, linked-workspace reload fetched only `2024`, `2023`, and `2022` year-detail payloads, and a real step-3 save updated `2024` in place while the reviewed count advanced) | files:docs/SETUP_WIZARD_UIUX_REAUDIT.md | docs:N/A | status: clean

### S-142 substeps

- [x] Move form builders, comparison labels, dataset-label helpers, and other stateless local helpers out of `OverviewPageV2.tsx` into dedicated V2 helper modules
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/*.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:7b09893446f544549f5c6635af9854d6c89825dc | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/overviewLabels.ts,apps/web/src/v2/overviewManualForms.ts | docs:N/A | status: clean

- [x] Move year-priority and prefetch selection logic into dedicated pure selectors so page render code stops owning those derivations inline
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/*.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:cde9d6fe41f69f4fc6952c5544b2423608be3e88 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/overviewSelectors.ts | docs:N/A | status: clean

### S-143 substeps

- [x] Extract overview loading, search, connect, and import orchestration into one dedicated hook/module without changing current API call order or visible loading states
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/api.ts, apps/web/src/v2/*.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:efcbca20d67265fe7f9fbb13b238b5bbce3cc99d | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/overviewOrchestration.ts | docs:N/A | status: clean

- [x] Extract setup-step derivation, year-lane selection, and summary-state wiring into a dedicated hook so page render logic stops recomputing wizard state inline
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/overviewWorkflow.ts, apps/web/src/v2/*.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:737b73f8fa4f34640cd986048386c342340feb1f | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/useOverviewSetupState.ts | docs:N/A | status: clean

### S-144 substeps

- [x] Extract manual year patch editor state, dirty guards, and save/reopen behavior into a dedicated hook while preserving the accepted step-2 and step-3 interactions
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/api.ts, apps/web/src/v2/*.ts, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:7873a857496d1d3cf65c873580f4f047700de887 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/useOverviewManualPatchEditor.ts | docs:N/A | status: clean

- [x] Extract statement, workbook, and QDIS import workflow coordination into dedicated modules/hooks so the page no longer owns every import-mode branch inline
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/yearReview.ts, apps/web/src/api.ts, apps/web/src/v2/*.ts, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:c7adf37e724d8f84f676cdd8a9652757a3e0f176 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/overviewImportWorkflows.ts | docs:N/A | status: clean

### S-145 substeps

- [x] Extract the step-2 import board and shared year-card presentation pieces into dedicated components without regressing row-local editing or parked-year behavior
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/*.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:3a62d6273f236a29ccab952f46880858897fc104 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewImportBoard.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Extract the step-3 review list, card action cluster, and review/edit card body into dedicated components without reintroducing a secondary review slab
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/v2.css, apps/web/src/v2/*.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/yearReview.test.ts
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:2dc63929685d7f8e9b3820caeac9644d06de4fb1 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/OverviewReviewBoard.tsx | docs:N/A | status: clean

### S-146 substeps

- [x] Extract the connect/search step, baseline step, and forecast handoff step into dedicated components so `OverviewPageV2` stops rendering every wizard section inline
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/AppShellV2.tsx, apps/web/src/v2/*.tsx, apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:bd97c205962d346ec7faf348c8107ba3256e080f | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/OverviewWizardPanels.tsx | docs:N/A | status: clean

- [x] Extract the sticky summary/support rail into dedicated components without changing current summary counts, gating text, or linked-workspace context copy
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/*.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:a6aba4125334a2293c41a1189a9e03bfa8de5b13 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx,apps/web/src/v2/OverviewSupportRail.tsx | docs:N/A | status: clean

### S-147 substeps

- [x] Reduce `OverviewPageV2.tsx` to a route-level orchestration shell that primarily wires extracted hooks/components together instead of owning the full workflow implementation
  - files: apps/web/src/v2/OverviewPageV2.tsx, apps/web/src/v2/*.ts, apps/web/src/v2/*.tsx, apps/web/src/v2/OverviewPageV2.test.tsx
  - run: pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx src/v2/yearReview.test.ts src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck
  - evidence: packet:d18647861d76a7bb6dbd1a032e66278f227a5d90 | run:pnpm --filter ./apps/web test -- src/v2/OverviewPageV2.test.tsx src/v2/AppShellV2.test.tsx src/v2/yearReview.test.ts src/components/LoginForm.test.tsx && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

- [x] Add or tighten focused regression coverage for the extracted seams so future edits no longer depend on full-file reasoning alone
  - files: apps/web/src/v2/OverviewPageV2.test.tsx, apps/web/src/v2/AppShellV2.test.tsx, apps/web/src/v2/yearReview.test.ts, apps/web/src/components/*.test.tsx, apps/web/src/v2/*.tsx, apps/web/src/v2/*.ts
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:48dda78766336b622f082ae09e166ddb89a6dff9 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx,apps/web/src/v2/OverviewPageV2.tsx | docs:N/A | status: clean

### S-148 substeps

- [x] Run the focused web regression bundle for the refactored Overview setup flow
  - files: apps/web/src/v2/**, apps/web/src/components/**, apps/web/src/i18n/locales/*.json
  - run: pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck
  - evidence: packet:e29efc0f36d1883fc182804c78720164b4b351e2 | run:pnpm --filter ./apps/web test -- src/components/LoginForm.test.tsx src/v2/AppShellV2.test.tsx src/v2/OverviewPageV2.test.tsx src/v2/yearReview.test.ts src/i18n/locales/localeIntegrity.test.ts && pnpm --filter ./apps/web typecheck -> PASS | files:apps/web/src/v2/OverviewPageV2.test.tsx | docs:N/A | status: clean

- [x] Re-run a linked-workspace live audit from login through step 3 save and step-6 handoff, and record whether the refactor preserved the accepted setup behavior in `docs/SETUP_WIZARD_UIUX_REAUDIT.md`
  - files: apps/web/src/**, apps/api/src/v2/**, apps/api/src/veeti/**, docs/SETUP_WIZARD_UIUX_REAUDIT.md
  - run: N/A (manual browser audit allowed)
  - evidence: packet:02dc65b9d37ef75ac48489c3d0180da5250a43cb | run:manual browser audit -> PASS (existing linked workspace on `http://127.0.0.1:4173` opened at step 3, a reversible `2024` save path restored `Material och tjänster` back to `69 168`, remaining years advanced to step 6, and the handoff opened `/forecast` plus `/reports`) | files:docs/SETUP_WIZARD_UIUX_REAUDIT.md | docs:N/A | status: clean
