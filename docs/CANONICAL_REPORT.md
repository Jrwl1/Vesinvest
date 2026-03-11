# CANONICAL_REPORT (OS hardening pass)

Date: 2026-02-10
Mode: PLAN (docs-only)

## Why this pass ran

The OS contract needed hardening so future runs can be triggered by only PLAN/DO/REVIEW without restating instructions.

## What changed

- `AGENTS.md`: replaced ambiguous protocol text with strict mode router, deterministic read/write permissions, output contracts, caps, and stop conditions.
- `docs/CANONICAL.md`: made `AGENTS.md` top-level operating contract; tightened conflict hierarchy and language policy.
- `docs/PROJECT_STATUS.md`: shortened to current snapshot with blockers and 5 next actions.
- `docs/ROADMAP.md`: kept V1 path explicit for hosted deployment, security gates, depreciation split, and PDF cashflow acceptance.
- `docs/BACKLOG.md`: added explicit `TBD (Owner: Customer)` queue and removed ambiguity.
- `docs/SPRINT.md`: normalized to 5 executable DO items with Do/Files/Acceptance/Evidence/Stop/Status.
- `docs/DECISIONS.md`: append-only superseding note for stale pending decisions section.
- `docs/WORKLOG.md`: appended one PLAN line for this run.

## Conflicts found and resolved

1. `AGENTS.md` previously blocked `docs/CANONICAL.md` edits, but PLAN required canonical maintenance.
   - Winner: updated AGENTS contract. PLAN may update CANONICAL docs; DO/REVIEW may not.
2. `docs/DECISIONS.md` had a historical pending list that conflicted with ADR-012..ADR-018.
   - Winner: ADR-012..ADR-018. Pending list is explicitly superseded by new append-only note.
3. `docs/SPRINT.md` lacked strict execution schema.
   - Winner: AGENTS hard schema; sprint rewritten to exact executable format.

## Remaining TBDs (real TBDs only)

All remaining TBDs are business inputs owned by Customer and are listed in `docs/BACKLOG.md` as `B-TBD-01..05`.

## PLAN pass update (single-word usability hardening)

Date: 2026-02-10

Changes in this pass:

- `docs/SPRINT.md`: Do column rewritten to imperative, implementation-ready instructions so `DO` can execute without follow-up prompting.
- `docs/PROJECT_STATUS.md`: removed open-question list and moved ownership to backlog TBD queue to avoid DO-time ambiguity.
- `docs/BACKLOG.md`: clarified that `B-TBD-*` items are customer-owned acceptance inputs and not automatic DO blockers.

Why required:

- Single-word invocation only works reliably when sprint instructions are command-style and unknowns are tracked outside active execution state.

## PLAN pass update (DO-ready large-step sprint format)

Date: 2026-02-10

Changes in this pass:

- `docs/SPRINT.md`: kept exactly 5 sprint items and converted each `Do` cell into a large imperative command with short implementation checklist.
- `docs/PROJECT_STATUS.md`: removed planning-oriented blockers/actions that could pull DO into scope decisions; replaced with execution-oriented status.
- `docs/BACKLOG.md`: kept customer-owned `B-TBD` items explicitly non-blocking unless a sprint Stop condition is triggered.

Why required:

- Single-word `DO` must be able to execute the top sprint item immediately from `Do + Files + Acceptance + Evidence + Stop` without extra user prompting.

## REVIEW pass update (evidence blocker)

Date: 2026-02-10
Mode: REVIEW

Findings:

- `docs/SPRINT.md` rows `S-01..S-05` are still `TODO` and Evidence cells are placeholders, not concrete artifacts.
- No verifiable commit hash, file-level diff evidence, test output, or generated artifacts are attached in sprint rows.

Actions taken:

- Added REVIEW blocker to `docs/PROJECT_STATUS.md`.
- Added `B-104` to `docs/BACKLOG.md` to keep Evidence formatting deterministic in DO runs.

Stop reason:

- REVIEW stopped under AGENTS stop condition: evidence is missing, so acceptance checks cannot be completed.

## REVIEW pass update (anti-deadlock evidence policy)

Date: 2026-02-10
Mode: REVIEW

Changes in this pass:

- `AGENTS.md` REVIEW protocol no longer stops when sprint Evidence is missing for `TODO` items.
- REVIEW must now output `Evidence needed` per affected sprint item and continue structural checks (format, scope, forbidden-touch, drift).
- REVIEW stop conditions are restricted to forbidden file changes, scope violations, or canonical hierarchy contradictions.

Why required:

- Prevents REVIEW deadlock before DO can generate evidence while preserving governance checks.

## PLAN pass update (DONE semantics A+B hardening)

Date: 2026-02-10
Mode: PLAN (docs-only)

Changes in this pass:

- `AGENTS.md`: DO now promotes row state to `READY` (not `DONE`) after all substeps are checked with minimum evidence.
- `AGENTS.md`: REVIEW is the only mode allowed to set `Status=DONE`, and only after Acceptance/Evidence verification.
- `docs/SPRINT.md`: lifecycle clarified as `TODO -> IN_PROGRESS -> READY -> DONE`, with `DONE` reserved for REVIEW.

Why required:

- Prevents false completion in DO runs and makes completion audit-friendly by separating implementation readiness (`READY`) from verified acceptance (`DONE`).

## REVIEW pass update (evidence/state verification)

Date: 2026-02-10
Mode: REVIEW

Findings:

- Working tree dirty: `AGENTS.md`, `apps/api/src/projections/projection-engine.service.ts`, `docs/SPRINT.md`, `docs/WORKLOG.md`.
- No sprint row is `READY`; `S-01` is `IN_PROGRESS`, `S-02..S-05` are `TODO`.
- `S-01` has partial substep evidence with uncommitted code; row-level acceptance evidence is incomplete.
- `S-02..S-05` had placeholder row Evidence and were marked `Evidence needed`.

Actions taken:

- Updated only allowed review docs: `docs/SPRINT.md` Evidence cells and `docs/PROJECT_STATUS.md` snapshot.
- No product code changes were made during this REVIEW run.

## REVIEW pass update (S-01 evidence contradiction)

Date: 2026-02-10
Mode: REVIEW

Findings:

- Working tree dirty across S-01-related API/web files plus docs (`docs/SPRINT.md`, `docs/WORKLOG.md`).
- `S-01` remains `IN_PROGRESS` and is not eligible for acceptance because row status is not `READY`.
- Checked S-01 substeps still lack required `commit/run/files` evidence format.
- `S-01` substep-6 evidence in `docs/SPRINT.md` claims successful `pnpm test`, while `docs/WORKLOG.md` records that substep as blocked by a failing run.

Actions taken:

- Updated `docs/SPRINT.md` row-level Evidence for `S-01` to record non-eligibility and the contradiction.
- Updated `docs/PROJECT_STATUS.md` blockers and next actions to reflect verified evidence state.

## REVIEW pass update (post-commit evidence conformance)

Date: 2026-02-11
Mode: REVIEW

Findings:

- Working tree dirty: `docs/SPRINT.md`, `docs/WORKLOG.md`.
- Latest DO evidence confirms `S-01` substep 6 rerun was committed as `12df429`.
- `S-01` remains `IN_PROGRESS` and is not eligible for acceptance because row status is not `READY`.
- `S-01` checked substeps 1-5 still do not match required evidence format: `commit | run | files`.
- `S-02..S-05` remain `TODO` with `Evidence needed`.

Actions taken:

- Updated `docs/SPRINT.md` row-level Evidence for `S-01` to record `Not eligible (status != READY)` and evidence-format gap.
- Updated `docs/PROJECT_STATUS.md` blockers/next actions to reflect post-commit state.

## REVIEW pass update (S-03 acceptance verification)

Date: 2026-02-11
Mode: REVIEW

Findings:

- `S-03` was `READY` with all substeps checked and commit-per-substep evidence present.
- Substep evidence includes regression output and commit trail (`deda88f`, `52e6794`, `1c34f79`, `50ae9c4`, `7433411`, `bfd9669`).
- Acceptance for depreciation split is satisfied based on projection-engine and regression test results.
- `S-04` and `S-05` remain `TODO` with `Evidence needed`.

Actions taken:

- Updated `docs/SPRINT.md` `S-03` row Evidence with commit/test summary and set `Status=DONE`.
- Updated `docs/PROJECT_STATUS.md` snapshot, blockers, and next actions for `S-04..S-05`.

## REVIEW pass update (S-04 acceptance verification)

Date: 2026-02-11
Mode: REVIEW

Findings:

- `S-04` was `READY` with all six substeps checked and commit/run evidence present.
- Evidence links commit chain (`5b91ec3`, `a480d5f`, `0943695`, `89b1cbb`, `f15ae01`, `4808bdb`) and sample artifact path `apps/api/sample-output/sample-cashflow.pdf`.
- Current working tree was clean during verification.
- `S-05` remains `TODO` with `Evidence needed`.

Actions taken:

- Updated `docs/SPRINT.md` `S-04` row `Status` to `DONE` (Acceptance verified).
- Updated `docs/PROJECT_STATUS.md` snapshot, blockers, and next actions to focus on `S-05`.

## REVIEW pass update (S-05 acceptance verification)

Date: 2026-02-11
Mode: REVIEW

Findings:

- `S-05` was `READY` with all six substeps checked and evidence present for build/typecheck/security/readiness/gate-failure/dry-run checks.
- Evidence references commit range `e8747ab..d81abf4` and release-gate checklist updates in `DEPLOYMENT.md`, `README.md`, `TESTING.md`, `package.json`, and `railway.toml`.
- Acceptance criteria for executable release gate checklist are satisfied for sprint closure.
- Pre-existing dirty working tree detected on `apps/api/sample-output/sample-cashflow.pdf` during this REVIEW run.

Actions taken:

- Updated `docs/SPRINT.md` `S-05` row `Status` to `DONE` (Acceptance verified).
- Updated `docs/PROJECT_STATUS.md` snapshot and next actions for post-sprint acceptance/signoff work.

## PLAN pass update (BudgetPage crash unblocking sprint reset)

Date: 2026-02-11
Mode: PLAN (docs-only)

Changes in this pass:

- Replaced `docs/SPRINT.md` with a fresh executable 5-row queue (`S-01..S-05`) where `S-01` is BudgetPage hooks-order crash recovery.
- Added explicit acceptance text for `S-01`: no hooks-order warnings, both payload paths render, no white-screen on hard reload.
- Updated `docs/PROJECT_STATUS.md` blockers and next actions to match reopened execution order.
- Updated `docs/BACKLOG.md` with Epic E5 for BudgetPage runtime stability and deterministic lint/typecheck/release-check gates.
- Updated `docs/ROADMAP.md` M0 done criteria to include executable runtime stability and gate-hardening queue.

Why required:

- All prior sprint rows were `DONE`, so DO had no selectable substep.
- A new active sprint queue is required to resume deterministic DO execution with the highest-priority runtime crash fix first.

## PLAN pass update (remove numeric substep cap)

Date: 2026-02-11
Mode: PLAN (docs-only)

Changes in this pass:

- Removed numeric substep cap from DO/sprint rules (`min=6 max=10`).
- Updated sprint rule text to allow variable substep counts while keeping deterministic one-substep DO execution.

Why required:

- Paste formatting can strip `-` markers and visually collapse `6-10` into `610`, creating fragile, ambiguous constraints.
- Variable substep counts keep the protocol robust while preserving commit-per-substep and clean-tree enforcement.

## PLAN pass update (KVA import customer-usable sprint queue)

Date: 2026-02-11
Mode: PLAN (docs-only)

Changes in this pass:

- Replaced sprint queue content with a new executable `S-01..S-05` sequence focused on KVA import customer usability.
- Set `S-01` to the customer workflow target: `KVA totalt` extraction, preview-by-year confirmation, and Talousarvio persistence.
- Added explicit happy-path proof substeps using fixture `fixtures/Simulering av kommande lönsamhet KVA.xlsx`.
- Updated roadmap/status/backlog snapshots to align with the new queue.

Conflict handling:

- User text used `610` in substep-count wording. Canonical rule now allows variable flat substep counts, so this pass preserved deterministic DO behavior without reinstating numeric caps.

Why required:

- Current sprint queue was fully `DONE` and no longer represented the next customer-critical workflow.
- KVA import needed a concrete, execution-ready path from preview extraction to persisted Talousarvio values.

## PLAN pass update (KVA workflow correction: historical years and totals-only modal)

Date: 2026-02-12
Mode: PLAN (docs-only)

Findings from code reality review:

- Subtotal totals are already extracted from `KVA totalt` (`extractSubtotalLines`), not from `Blad1`.
- `Blad1` is still parsed as optional account-level Tier B rows and exposed in the KVA modal.
- KVA modal currently includes Tuloajurit editing and sends `revenueDrivers` on confirm.
- Confirm path currently accepts optional `accountLines` and persists both `revenueDrivers` and `accountLines`.

Changes in this pass:

- Replanned `docs/SPRINT.md` to a fresh executable queue aligned to agreed behavior: 3 historical years only, forecast excluded, `Förändring i...` excluded, totals preview before apply, and no import-modal Tuloajurit/Blad1 account rows.
- Added explicit deterministic fallback rule when style-based gray-year detection is not reliable: earliest 3 year columns in KVA totals table.
- Updated `docs/BACKLOG.md`, `docs/PROJECT_STATUS.md`, and `docs/ROADMAP.md` to match corrected scope and execution order.

Conflict handling:

- Resolved prior planning assumption that totals should be switched away from `Blad1`.
- Canonical precedence used: code reality + customer correction confirm totals source is already `KVA totalt`; planning now targets year filtering, payload mapping, and UX simplification instead of source-sheet switch.

---

## PLAN pass update (KVA Talousarvio correctness re-plan)

Date: 2026-02-12
Mode: PLAN (docs-only)

Why this pass ran:

- Previous sprint did not deliver agreed Talousarvio behavior: imported 3-year data, no tuloajurit on Talousarvio, correct result calculation (no sign/type inversion). Customer requested re-plan with explicit decisions and regression coverage.

Changes in this pass:

- Replaced `docs/SPRINT.md` with new 5-section plan (S-01..S-05): sign convention lock + regression (S-01), KVA parser 3-year bucket+breakdown (S-02), preview UX bucket-first and no Vuosi selector (S-03), confirm 3 budgets + Talousarvio no tuloajurit (S-04), E2E and gates (S-05). Recorded decisions in sprint: Option A sign convention, rows imported from KVA totalt, missing bucket = 0, Vuosi selector removed, Talousarvio historical-only.
- Updated `docs/ROADMAP.md` M0 done criteria to include bucket+breakdown, one budget per year, Talousarvio no tuloajurit, Option A.
- Updated `docs/PROJECT_STATUS.md` to reflect new sprint (all TODO) and aligned blockers/next actions.
- Updated `docs/BACKLOG.md`: added B-611 (Forecast/Ennuste tuloajurit re-enable, out of scope).
- `docs/DECISIONS.md`: appended ADR-021 (sign convention Option A), ADR-022 (KVA import scope and Talousarvio).
- `docs/WORKLOG.md`: appended one PLAN line.

Conflicts found and resolved:

- None. Plan aligns with existing code (BudgetPage result formula, repo valisummat storage) and product non-negotiables.

---

## REVIEW pass (S-01..S-05 DONE)

Date: 2026-02-12
Mode: REVIEW

Findings (by severity):

- None. All five sprint rows had Status=READY with Evidence satisfying Acceptance (commit hashes + test/gate output).
- S-01: Option A documented, import/repo normalize positive, regression test in budget-totals.contract.spec.ts.
- S-02: Year selection from KVA totalt only (1d451e7), exclusions and breakdown covered by existing tests.
- S-03: 9c2a844 — bucket-first expandable, Vuosi removed, confirm 3 years (3 API calls), warnings filtered.
- S-04: 99e85f9 — Talousarvio hides tuloajurit and 3000 row when useValisummaAsRows; computedRevenue=0 for that path.
- S-05: Contract + BudgetPage tests and root gates (lint/typecheck/test) PASS.

Actions taken:

- Set S-01, S-02, S-03, S-04, S-05 Status to DONE in `docs/SPRINT.md`.
- Updated `docs/PROJECT_STATUS.md` (current state, blockers, next actions).
- Appended one REVIEW line to `docs/WORKLOG.md`.

---

## PLAN pass (Talousarvio locked-in plan → sprint S-01..S-05)

Date: 2026-02-12
Mode: PLAN

Why this pass ran:

- Customer locked in Talousarvio tab + KVA import decisions (1B explicit batch grouping, 2B Tulos in header, 3A remove Lägg till rad, 4B confirm FI/SWE/ENG, 5 Källa per card, 6A Investoinnit always shown). Plan document updated; sprint must reflect executable work.

Changes in this pass:

- Replaced `docs/SPRINT.md` with 5 new items: S-01 schema + import batch + Källa (migration, confirm sets batch and stores filename+timestamp), S-02 API for budget sets + selector loads 3 budgets, S-03 Talousarvio 3 year cards + 4 buckets + per-bucket expand + Tulos header + remove add-line + Källa, S-04 KVA year selector when >3 years + preview per-bucket expand + Diagnostiikka collapsible + confirm i18n (Tallenna/Spara/Save), S-05 validation + i18n + regression + root gates.
- Recorded decisions in sprint: locked (1)–(6) as above; retained Option A, ADR-021/022, missing bucket, Vuosi selector, Talousarvio historical-only.
- Updated `docs/ROADMAP.md` M0 done criteria to reference next Talousarvio 3-year-card UX.
- Updated `docs/PROJECT_STATUS.md`: current state = new S-01..S-05 TODO; next action = DO first substep of S-01.
- Updated `docs/BACKLOG.md`: added B-612 (Talousarvio 3-year-card UX, in sprint).
- `docs/WORKLOG.md`: appended one PLAN line.
- `docs/DECISIONS.md`: appended ADR-023 (Talousarvio 3-year-card UX locked decisions 1B–6).

Conflicts found and resolved:

- None. Locked plan is customer-approved; sprint structure follows AGENTS schema (Do/Files/Acceptance/Evidence/Stop/Status).

## PLAN pass (KVA import lockdown — single-source KVA totalt + preview UI)

Date: 2026-02-12
Mode: PLAN

Why this pass ran:

- Customer locked KVA import lockdown plan: (1) Only KVA totalt sheet for Talousarvio import (Option A); no Vatten KVA / Avlopp KVA in subtotal extraction. (2) Preview UI: underrow 2 decimals max, € next to input, Tulot label green, Kulut label red. (3) Layout discovered during implementation; docs/KVA_IMPORT_LOCKDOWN.md.

Changes in this pass:

- Replaced `docs/SPRINT.md` with 5 new items: S-01 underrow 2 decimals + € symbol, S-02 Tulot green / Kulut red, S-03 extractSubtotalLines only KVA totalt, S-04 tests and fixture expectations for KVA totalt only, S-05 docs/KVA_IMPORT_LOCKDOWN.md and verification.
- Recorded decision in sprint: Option A (only KVA totalt); layout discovered during impl.
- Updated `docs/ROADMAP.md` M0: next = KVA import lockdown (single-source, UI, doc).
- Updated `docs/PROJECT_STATUS.md`: sprint rotated to S-01..S-05 (lockdown); next action = DO first substep S-01.
- Updated `docs/BACKLOG.md`: B-612 closed; B-613 added (KVA import lockdown, in sprint).
- `docs/WORKLOG.md`: appended one PLAN line.
- `docs/DECISIONS.md`: appended ADR-024 (Talousarvio import single-source KVA totalt).

Conflicts found and resolved:

- None. Plan aligns with existing ADR-021/022/023 and canonical hierarchy.

## REVIEW pass (KVA import lockdown S-01..S-05 DONE)

Date: 2026-02-12
Mode: REVIEW

Findings:

- All five sprint rows READY with commit evidence and run/output in substeps. Acceptance verified: S-01 underrow 2 decimals + €; S-02 Tulot green/Kulut red; S-03 sourceSheets only KVA totalt; S-04 tests pass; S-05 doc exists with Option A and verification steps.
- Set S-01..S-05 Status to DONE. Updated PROJECT_STATUS, BACKLOG (B-613 DONE), WORKLOG. No scope drift; no forbidden file edits.

## PLAN pass (Talousarvio tab view sprint)

Date: 2026-02-12
Mode: PLAN

Changes:

- Replaced `docs/SPRINT.md` with 5 new items: S-01 top-of-page message (historical base for projection), S-02 empty state + Add a line under TULOT/KULUT and API support, S-03 row labels and i18n fallback for categoryKey, S-04 TULOS prominence and section styling, S-05 regression and root gates. All Status TODO. Recorded decision: Talousarvio tab view locked (message, manual entry, labels, styling).
- Updated `docs/ROADMAP.md` M0: next = Talousarvio tab view (message, empty state, manual add, labels, TULOS/sections).
- Updated `docs/BACKLOG.md`: B-614 added (Talousarvio tab view, in sprint).
- Updated `docs/PROJECT_STATUS.md`: current sprint = Talousarvio tab view S-01..S-05; next action = DO first substep S-01.
- `docs/WORKLOG.md`: appended one PLAN line.

Conflicts found and resolved:

- None. Plan follows locked Talousarvio tab view plan (keep name, message, manual entry, empty state, labels, styling).

---

## PLAN pass (Ennuste page sprint rotation)

Date: 2026-02-12
Mode: PLAN

Why this pass ran:

- User requested docs-only PLAN update to replace the active Talousarvio sprint with a new **Ennuste** sprint.
- Goal is locked as: completely working Ennuste page per `docs/PROJECTION_UX_PLAN.md`.

Changes in this pass:

- Replaced `docs/SPRINT.md` content with a new executable `S-01..S-05` sequence for Ennuste:
  - `S-01`: API/domain override model + persistence for per-year and `% from year X`.
  - `S-02`: same-screen Ennuste input controls for vesi/jätevesi.
  - `S-03`: compute integration + validation.
  - `S-04`: Diagram sub-view inside Ennuste tied to table data.
  - `S-05`: regression + root gates.
- Set all five sprint row statuses to `TODO`.
- Updated `docs/ROADMAP.md` M0 done criteria to point next execution target to Ennuste completion scope in `docs/PROJECTION_UX_PLAN.md`.
- Updated `docs/BACKLOG.md`:
  - Marked `B-614` as DONE (no longer active sprint focus).
  - Added `B-615` for Ennuste page completion in sprint `S-01..S-05`.
  - Kept `B-611` as active dependency for Ennuste completion.
- Updated `docs/PROJECT_STATUS.md` snapshot/blockers/next actions to the new Ennuste sprint.
- Prepared one WORKLOG PLAN append line.

Conflicts found and resolved:

- None. This is a sprint rotation only; ADR-021..ADR-024 remain in force and are not contradicted.

## PLAN pass (Ennuste UX betterment sprint from audit)

Date: 2026-02-12

Changes in this pass:

- **docs/ROADMAP.md:** M0 next execution target updated to Ennuste UX betterment (5-step sprint from ENNUSTE_UX_AUDIT.md); Ennuste page noted as functionally complete.
- **docs/BACKLOG.md:** B-615 marked DONE; B-616 added (Ennuste UI/UX betterment per ENNUSTE_UX_AUDIT.md, 5-step sprint) and set in sprint.
- **docs/SPRINT.md:** Replaced with 5 new items. Goal: working Ennuste UI with every problem in docs/ENNUSTE_UX_AUDIT.md addressed. S-01: DriverPlanner layout/grouping (audit 1–8). S-02: Controls row, create-scenario modal, last-computed, Compute reason (9–14). S-03: Verdict, result tabs, table, diagram (15–21). S-04: RevenueReport collapsible, purpose, end-of-page (22–26). S-05: Global (delete, anchors, empty states), a11y, final pass verifying all 33 audit items (27–33).
- **docs/PROJECT_STATUS.md:** Current state and next actions updated for Ennuste UX betterment sprint.
- One PLAN line appended to docs/WORKLOG.md.

Conflicts found and resolved:

- None. PROJECTION_UX_PLAN.md unchanged (same-screen variables, diagram sub-view). Create-scenario modal is explicitly allowed; RevenueReport treatment and layout changes stay within existing scope.

---

## PLAN pass (Forecast/Reports trust hardening sprint S-11..S-15)

Date: 2026-03-02
Mode: PLAN (docs + execution kickoff)

Why this pass ran:

- Live Forecast audit identified trust issues in report consistency, compute/report flow clarity, scenario loading UX, repetitive investment editing, and repeated list/context API calls.
- Previous sprint rows (`S-06..S-10`) were already `DONE`; new executable queue was required for deterministic DO/REVIEW execution.

Changes in this pass:

- Replaced `docs/SPRINT.md` with new active queue `S-11..S-15` and detailed one-substep implementation plan:
  - `S-11` report freshness token + summary/snapshot consistency.
  - `S-12` deterministic compute-before-report UX flow.
  - `S-13` scenario switch loading clarity.
  - `S-14` investment editor bulk actions + numeric guardrails.
  - `S-15` short-lived GET cache + force refresh path.
- Updated `docs/PROJECT_STATUS.md` snapshot and next actions to execute `S-11..S-15` via DO/REVIEW.
- Updated `docs/ROADMAP.md` M0 execution target text to reference Forecast/Reports trust hardening.
- Updated `docs/BACKLOG.md` with Epic E7 (`B-701..B-706`) for traceable follow-up and acceptance scope.

Conflicts found and resolved:

- None. Canonical hierarchy is consistent: AGENTS contract + code reality + active planning docs.

---

## PLAN pass update (continuous DO/REVIEW loop policy)

Date: 2026-03-04
Mode: PLAN

Why this pass ran:

- User requested removal of stop-and-wait behavior between DO and REVIEW runs.
- Required behavior: once started with `DO`, continue `DO -> REVIEW -> DO -> REVIEW` until whole active sprint list is done (or blocked by protocol stop condition).

Changes in this pass:

- `AGENTS.md`: added **Continuous execution policy (default)** section.
  - `DO` now triggers autonomous internal `DO -> REVIEW` cycles.
  - Loop continues until all active sprint rows are `DONE`, a blocker is recorded, or a stop condition is hit.
  - Each internal cycle still obeys per-protocol permissions, commit contracts, and one-line worklog append rule.
- `docs/ROADMAP.md`: aligned M0 execution target text with continuous loop policy and current sprint target `S-16..S-20`.
- `docs/SPRINT.md`: added execution-policy note that sprint should be driven via continuous `DO -> REVIEW` cycles.
- `docs/PROJECT_STATUS.md`: updated snapshot and next actions to reflect `S-17` readiness and continuous execution policy.
- `docs/BACKLOG.md`: marked `B-105` as DONE (policy implemented in `AGENTS.md`).

Conflicts found and resolved:

- None. Change is an operating-policy hardening and does not alter product scope boundaries.

## PLAN pass update (realign sprint docs to shipped statement-import code)

Date: 2026-03-08
Mode: PLAN

Why this pass ran:

- The active sprint docs (`S-21..S-25`) had drifted behind the codebase after the shipped bokslut OCR import and provenance work.
- User requested a docs-only PLAN pass that keeps the same sprint direction and only makes the planning documents reflect current code reality.

Changes in this pass:

- `docs/SPRINT.md`: kept the active sprint rows `S-21..S-25`, but realigned row status, evidence, and substeps to the shipped code.
  - `S-21` moved to `READY` with evidence tied to commits `c68ce9d`, `96f53ae`, and `9b8ae95`.
  - `S-22`, `S-23`, and `S-25` now show partial shipped progress instead of stale `TODO` or parser-blocked state.
  - `S-24` remains ahead with no false completion claims.
- `docs/PROJECT_STATUS.md`: replaced stale `S-16..S-20` snapshot with the current `S-21..S-25` execution picture.
- `docs/ROADMAP.md`: updated M0 execution-target text to point at the active `S-21..S-25` cycle and note that statement-import productization is already shipped code.
- `docs/BACKLOG.md`: marked `B-801` as `DONE` and moved shipped statement-import productization tasks into the Done section.
- `docs/WORKLOG.md`: appended one PLAN line for this realignment pass.

Conflicts found and resolved:

1. `docs/SPRINT.md` claimed `S-21` was blocked on `pypdf` text extraction.
   - Winner: shipped code reality. Browser OCR with bundled local assets supersedes the old parser blocker.
2. `docs/PROJECT_STATUS.md` and `docs/ROADMAP.md` still referenced `S-16..S-20` as the active execution target.
   - Winner: active sprint docs and current code reality. Active execution target remains `S-21..S-25`.
3. `docs/BACKLOG.md` still treated `B-801` as open.
   - Winner: shipped code reality. OCR-capable extraction path has been chosen and implemented.

## PLAN pass update (variable-length sprint queue)

Date: 2026-03-08
Mode: PLAN

Why this pass ran:

- User requested removal of the fixed 5-row sprint rule while keeping continuous `DO -> REVIEW` execution until the active sprint work is done or blocked.

Changes in this pass:

- `AGENTS.md`: removed the fixed `docs/SPRINT.md` 5-row cap and replaced it with a variable-length active queue requirement.
- `docs/CANONICAL.md`: updated the canonical set wording from `active DO queue (5 items)` to `active DO queue`.
- `docs/SPRINT.md`: updated the header text so execution targets the active queue rather than exactly 5 rows.
- `docs/PROJECT_STATUS.md`: updated the snapshot to the current active queue `S-26..S-30`, removed the fixed-window planning language, and renamed `Next 5 actions` to `Next actions`.
- `docs/ROADMAP.md`: updated M0 done criteria to reference the active variable-length queue in `docs/SPRINT.md`.
- `docs/BACKLOG.md`: marked the variable-length sprint-schema hardening task as done.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. `AGENTS.md`, `docs/CANONICAL.md`, `docs/SPRINT.md`, and `docs/PROJECT_STATUS.md` still assumed a fixed 5-row sprint shape while the continuous-execution policy already targeted all active sprint rows.
   - Winner: user request plus current continuous-execution policy. The sprint queue is now variable-length, and completion remains tied to all active rows becoming `DONE` unless blocked.

## PLAN pass update (RUNSPRINT entry command)

Date: 2026-03-09
Mode: PLAN

Why this pass ran:

- User requested an explicit command to run the active sprint from the current starting point through the end without changing existing `DO` behavior.

Changes in this pass:

- `AGENTS.md`: added `RUNSPRINT` to the exact mode router and documented it as an explicit whole-sprint execution entry that uses the DO protocol and existing continuous loop engine.
- `docs/CANONICAL.md`: updated the top-level operating-contract wording to include `RUNSPRINT`.
- `docs/SPRINT.md`: updated execution-policy wording so both `DO` and `RUNSPRINT` are valid sprint-entry commands.
- `docs/PROJECT_STATUS.md`: updated blockers/next actions to reference `RUNSPRINT` as the explicit whole-sprint entry.
- `docs/ROADMAP.md`: updated M0 done criteria to reference deterministic `PLAN/DO/RUNSPRINT/REVIEW` contracts.
- `docs/BACKLOG.md`: recorded the `RUNSPRINT` contract hardening task as done.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. The repo already supported continuous `DO -> REVIEW` execution, but there was no explicit all-the-way-through command name for users.
   - Winner: user request. `RUNSPRINT` now provides the explicit whole-sprint entry while `DO` stays valid and unchanged.
2. `docs/DECISIONS.md` ADR-019 stated that the router matched only `PLAN / DO / REVIEW`.
   - Winner: updated AGENTS contract plus ADR-025. `RUNSPRINT` is now a canonical exact entry command.

## PLAN pass update (post-audit trust hardening sprint S-31..S-36)

Date: 2026-03-09
Mode: PLAN

Why this pass ran:

- A local Chrome DevTools audit against the refreshed V2 flow found one severe admin-safety issue plus several trust-eroding gaps in login/demo entry, Forecast result authority, cross-language copy, and desktop accessibility.

Changes in this pass:

- `docs/SPRINT.md`: replaced the completed UI-refresh queue with a new executable hardening queue `S-31..S-36`:
  - `S-31` destructive account-clear safety
  - `S-32` login/demo truth alignment
  - `S-33` explicit Forecast freshness/state model
  - `S-34` save-vs-compute authority and navigation restoration
  - `S-35` mixed-language cleanup
  - `S-36` desktop accessibility + final gates
- `docs/ROADMAP.md`: updated M0 execution target text to reflect that UI refresh is complete and trust hardening is now the active queue.
- `docs/PROJECT_STATUS.md`: replaced the “new PLAN needed” snapshot with the active `S-31..S-36` queue and next actions.
- `docs/BACKLOG.md`: added Epic E10 (`B-1001..B-1009`) for traceable follow-up scope and low-priority SEO deferral.
- `docs/WORKLOG.md`: appends one PLAN line for this planning pass.

Conflicts found and resolved:

1. The prior active queue in `docs/SPRINT.md` (`S-26..S-30`) was already fully `DONE`, so `DO` had no remaining executable work.
   - Winner: current audit findings and active planning needs. `S-31..S-36` is now the deterministic execution queue.
2. Demo-mode default behavior remains historically ambiguous between some docs and current local runtime.
   - Winner for this pass: shipped runtime truth. The sprint now aligns UI/docs to current behavior first; a future explicit product decision can still change the default later.

## PLAN pass update (precise clean-tree semantics)

Date: 2026-03-09
Mode: PLAN

Why this pass ran:

- The OS contract used `git status --porcelain` operationally, but did not explicitly say whether ignored local files counted as dirt. The user asked to make the rule precise rather than weakening the clean-tree requirement.

Changes in this pass:

- `AGENTS.md`: clean-tree semantics now state explicitly that `git status --porcelain` is authoritative.
- `AGENTS.md`: ignored local files are out of protocol scope; tracked changes and untracked non-ignored files still count as dirty.
- `docs/SPRINT.md`: execution header now mirrors the same clean-tree rule.
- `docs/ROADMAP.md`: M0 done criteria now mention deterministic clean-tree semantics.
- `docs/PROJECT_STATUS.md`: snapshot and next actions now reflect the refined rule.
- `docs/BACKLOG.md`: recorded the clean-tree clarification task as done.
- `docs/DECISIONS.md`: appended ADR-026 for the clean-tree policy.
- `docs/WORKLOG.md`: appends one PLAN line for this hardening pass.

Conflicts found and resolved:

1. Existing protocol behavior already relied on `git status --porcelain`, while human interpretation still treated ignored local scratch files as possible blockers.
   - Winner: actual protocol implementation plus explicit wording. Ignored local files are now clearly non-blocking, but tracked/unignored dirt still blocks.

## PLAN pass update (DO writes for sprint-scoped non-canonical product docs)

Date: 2026-03-10
Mode: PLAN

Why this pass ran:

- `RUNSPRINT` stopped at `S-32` substep 3 because the substep correctly listed `README.md` and `DEPLOYMENT.md`, but the DO contract still described allowed writes as code-only product files.

Changes in this pass:

- `AGENTS.md`: DO allowed writes now cover any product-scope file explicitly listed in the selected sprint substep `files:` scope, including non-canonical repo docs, config files, and env examples.
- `AGENTS.md`: added an explicit execution-rule note that sprint-listed non-canonical docs/config examples are editable during DO, while canonical planning docs and `AGENTS.md` remain forbidden.
- `docs/CANONICAL.md`: corrected supporting-doc paths from `docs/DEPLOYMENT.md` and `docs/TESTING.md` to the actual root files `DEPLOYMENT.md` and `TESTING.md`.
- `docs/SPRINT.md`: aligned the execution header and cleared the obsolete `S-32` substep-3 contract blocker so the next DO run can resume deterministically.
- `docs/PROJECT_STATUS.md`, `docs/ROADMAP.md`, and `docs/BACKLOG.md`: aligned to the new contract wording and recorded the hardening task as done.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. `S-32` required editing root product docs, while the DO allowed-writes text still implied code-only product scope.
   - Winner: active sprint scope plus canonical supporting-doc classification. Sprint-listed non-canonical product docs/config examples are now valid DO targets.
2. `docs/CANONICAL.md` listed `docs/DEPLOYMENT.md` and `docs/TESTING.md`, but code reality uses root `DEPLOYMENT.md` and `TESTING.md`.
   - Winner: repository file reality. Canonical supporting-doc paths now point to the real files.

## PLAN pass update (setup wizard sprint S-37..S-42)

Date: 2026-03-11
Mode: PLAN

Why this pass ran:

- User requested a planning pass grounded in current code that replaces the first-window dashboard with a six-step setup wizard, removes unnecessary setup-surface clutter, and uses user-facing planning language instead of sync/admin jargon.

Changes in this pass:

- `docs/ROADMAP.md`: updated M0 execution target from the accepted trust-hardening queue to the setup-wizard queue `S-37..S-42`, and aligned the contract text with the new PLAN dirty-tree baseline behavior.
- `docs/BACKLOG.md`: closed Epic E10 items as done and added Epic E11 for the guided setup wizard, truthful exclusion semantics, planning-baseline language, locked Ennuste handoff, and follow-up doc refresh.
- `docs/SPRINT.md`: replaced the completed `S-31..S-36` queue with a new executable queue `S-37..S-42`:
  - `S-37` wizard shell, sticky summary, and locked navigation
  - `S-38` truthful split between utility connection, year import, and baseline creation
  - `S-39` focused year-status review with three checks and no landing-page clutter
  - `S-40` non-destructive exclusion and single-year fix/keep/restore flow
  - `S-41` planning-baseline creation step and copy replacement for sync jargon
  - `S-42` final handoff that unlocks Ennuste only after setup completion
- `docs/PROJECT_STATUS.md`: updated snapshot, blockers, and next actions for the wizard queue.
- `docs/DECISIONS.md`: appended ADR-028 to lock the setup-wizard product decision and terminology.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. Customer flow requires step 2 (`Tuo valitut vuodet`) and step 5 (`Luo suunnittelupohja`) as separate actions, but current code couples both inside `syncImport` (`refreshOrg` + `generateBudgets`).
   - Winner: code reality for current behavior, customer requirement for target behavior. The plan now includes explicit contract-splitting work before shipping the wizard copy.
2. Customer flow requires non-destructive `Pois suunnitelmasta`, but current `removeImportedYearInternal` deletes snapshots and VEETI budgets before marking the year excluded.
   - Winner: code reality for current behavior, customer requirement for target behavior. The plan treats truthful non-destructive exclusion as required sprint work instead of relabeling the destructive path.
3. Current first window mixes import panels with readiness cards, next-step CTA logic, trend cards/chart, peer snapshot, admin ops snapshot, and detailed comparison workspace.
   - Winner: customer requirement plus code reality review. The plan removes or demotes those surfaces from the first-window setup path and keeps only step-relevant information on the landing flow.

## REVIEW pass update (S-37 shell row scope gap)

Date: 2026-03-11
Mode: REVIEW

Findings:

- `S-37` substeps 1-4 are committed, evidence-valid, and the tree is clean after each DO/docs pair.
- Shell acceptance is only partially satisfied: wizard step indicator, sticky setup summary, org chip formatting, and locked Ennuste/Reports behavior are in place.
- Row acceptance still fails on the single-primary-action requirement because the legacy import panels continue to expose multiple loud primary CTAs on the first window.
- No unchecked `S-37` substep remains, so `RUNSPRINT` cannot continue within current sprint structure without a planning update.

Actions taken:

- Kept `S-37` at `IN_PROGRESS` with explicit acceptance-gap evidence in `docs/SPRINT.md`.
- Updated `docs/PROJECT_STATUS.md` blockers/next actions and added `B-1111` to `docs/BACKLOG.md` so the next PLAN pass can restore executable scope.
