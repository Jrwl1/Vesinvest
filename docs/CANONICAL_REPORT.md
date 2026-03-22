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

## PLAN pass update (restore executable S-37 CTA-cleanup scope)

Date: 2026-03-11
Mode: PLAN

Why this pass ran:

- `RUNSPRINT` reached a review blocker in `S-37`: shell-level wizard work was landed, but the row still failed the single-primary-action acceptance because the legacy import panels kept multiple loud CTAs and no unchecked `S-37` substep remained.

Changes in this pass:

- `docs/SPRINT.md`: kept `S-37` active and added a new explicit substep to demote or remove extra primary CTAs from the legacy import panels, with combined AppShell/Overview regression plus typecheck evidence requirements.
- `docs/PROJECT_STATUS.md`: replaced the sprint-structure blocker with a normal next action to continue `RUNSPRINT` on the new `S-37` substep.
- `docs/BACKLOG.md`: moved `B-1111` from discovered-review follow-up wording into active sprint scope.
- `docs/ROADMAP.md`: sharpened the M0 execution target wording so the setup-wizard milestone explicitly includes one loud primary action at a time on the first window.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. REVIEW correctly found an acceptance gap in `S-37`, but the row no longer had an executable unchecked substep.
   - Winner: protocol executability. This pass restores deterministic `RUNSPRINT` behavior by turning the reviewed gap into an explicit `S-37` substep instead of leaving it stranded as narrative evidence only.

## PLAN pass update (wizard corrective refactor sprint S-43..S-47)

Date: 2026-03-12
Mode: PLAN

Why this pass ran:

- Live audit and focused code exploration showed that the initial wizard rollout is not structurally complete even though `S-37..S-42` were accepted.
- The confirmed failures are:
  1. connect treats available VEETI years as imported workspace years,
  2. step 3 is unreachable and connect can jump directly to step 4,
  3. `OverviewPageV2` still mounts stacked legacy setup surfaces,
  4. wizard i18n has wrong keys, missing keys, and incomplete parity coverage.

Changes in this pass:

- `docs/SPRINT.md`: replaced the completed queue with a new corrective queue `S-43..S-47`:
  - `S-43` separate and persist `workspaceYears`
  - `S-44` repair wizard progression and make step 3 reachable
  - `S-45` remove stacked legacy surfaces and mount one active step body
  - `S-46` fix wizard translation leaks and add parity coverage
  - `S-47` lock the fixed Kronoby flow with regression and smoke evidence
- `docs/ROADMAP.md`: updated M0 execution target from the accepted initial wizard rollout to the corrective wizard-completion queue.
- `docs/PROJECT_STATUS.md`: replaced the "wizard is complete" snapshot with the audited-corrective view and new blockers/next actions.
- `docs/BACKLOG.md`: closed the initial wizard rollout items as done and added Epic E12 for corrective wizard refactor work.
- `docs/DECISIONS.md`: appended ADR-029 to lock the distinction between available VEETI years and explicit workspace-imported years.
- `docs/WORKLOG.md`: appended one PLAN line for this pass.

Conflicts found and resolved:

1. Active planning docs said the setup wizard refactor was complete, but code reality and live audit showed connect still bypassed step 2 and the page still rendered stacked legacy sections.
   - Winner: code reality and live audit findings. The completed rollout is now treated as an initial slice, and the corrective queue `S-43..S-47` is the active execution target.
2. Existing wizard planning implicitly treated `importStatus.years` as imported workspace years, but backend code uses that field for available/effective VEETI years.
   - Winner: code reality. The plan now requires a separate persisted `workspaceYears` contract and updates canonical decisions accordingly.
3. The Finnish wizard leaks were previously described as generic mixed-language cleanup, but the current failures are specific wrong keys and missing locale entries in the wizard surface.
   - Winner: code reality. The new queue adds explicit locale-key repair and parity test coverage instead of relying on the already accepted mixed-language sprint.

## PLAN pass update (blocker-policy hardening after S-43 and S-46)

Date: 2026-03-14
Mode: PLAN

Why this pass ran:

- Recent sprint execution hit repeated avoidable blockers: pre-existing dirty files that were already inside the selected implementation area, same-package verification fallout outside the listed `files:` scope, and gate-tightening substeps that listed only the new test/parity file.

Changes in this pass:

- `AGENTS.md`: DO now allows auditable absorption of pre-existing dirty paths when they are already inside the selected substep scope, adds a bounded same-package gate-fix path for failed required verification runs, requires a pre-product-commit hygiene check, and distinguishes `HARD BLOCKED` from `GATE BLOCKED` without relaxing the final clean-tree rule.
- `docs/SPRINT.md`: aligned the execution header with the new baseline/gate-fix rules and widened the live `S-46` and `S-47` gate-tightening substeps so likely same-package implementation files are explicitly in scope.
- `docs/ROADMAP.md`, `docs/PROJECT_STATUS.md`, and `docs/BACKLOG.md`: aligned milestone, status, and traceability wording to the hardened blocker policy.
- `docs/DECISIONS.md`: appended a new ADR locking the scoped-baseline and same-package gate-fix policy.
- `docs/WORKLOG.md`: appended one PLAN line for this hardening pass.

Conflicts found and resolved:

1. Existing DO wording treated all pre-existing tracked dirt as a blocker even when the dirt was already inside the selected substep and later needed to be committed as part of that substep.
   - Winner: end-clean guarantee plus auditable in-scope absorption. DO may now start dirty only when every pre-existing dirty path is already in scope and can be safely explained.
2. Existing `files:` scoping forced a stop when a required package-level verification run failed in a same-package file outside the listed substep paths.
   - Winner: bounded same-package gate-fix handling. Minimal same-package fallout may now be fixed to make the required run pass; cross-package fallout remains blocked.
3. Live gate-tightening substeps in `S-46` and `S-47` listed only the new regression/parity files even though the expected fallout lived in the wizard implementation files.
   - Winner: gate-aware sprint authoring. Active substeps now include the likely same-package implementation files up front.

Dirty-tree handling:

- PLAN started with pre-existing non-doc dirt in `apps/web/src/v2/OverviewPageV2.test.tsx`.
- That product change is outside PLAN scope and must not be staged or committed by this docs-only pass.

Dirty-tree handling:

- PLAN started with pre-existing non-doc dirt in `apps/api/src/v2/dto/import-clear.dto.ts` and `apps/api/src/v2/dto/import-clear.dto.spec.ts`.
- Those product changes are outside PLAN scope and must not be staged or committed by this docs-only pass.

## PLAN pass update (patch corrective sprint with explorer findings and explicit re-audit closeout)

Date: 2026-03-12
Mode: PLAN

Why this pass ran:

- Follow-up explorer review showed that the first corrective sprint draft still left material frontend, backend, and closeout gaps.
- Missing items included: no explicit active-step contract deliverable, no requirement to retire `resolveNextBestStep`, no shell/body alignment acceptance, no sync-layer or `/import/sync` cleanup, no explicit cleanup of downstream `importStatus.years` consumers, no baseline/reset requirements for `workspaceYears`, incomplete wizard-chrome i18n scope, missing one-primary-CTA regression, and an underspecified final audit artifact.

Changes in this pass:

- `docs/SPRINT.md`: expanded `S-43..S-47` to cover:
  - sync-layer connect cleanup and `/import/sync` retirement/redefinition
  - downstream backend cleanup for `importStatus.years`
  - baseline/clear semantics for `workspaceYears`
  - one authoritative active-step contract including selected problem-year state
  - removal/retirement of obsolete `resolveNextBestStep` logic
  - shell/body alignment on the same active wizard step
  - one-primary-CTA regressions
  - broader wizard chrome i18n coverage and hard parity list updates
  - a final Finnish Kronoby UI/UX re-audit that must explicitly state `whole sprint succeeded` or `stopped by blocker: ...`
- `docs/PROJECT_STATUS.md`: updated current state, blockers, and next actions to reflect the patched corrective scope.
- `docs/ROADMAP.md`: updated M0 execution-target wording so the corrective queue now includes backend cleanup, active-step authority, CTA ownership, and the explicit re-audit closeout.
- `docs/BACKLOG.md`: expanded Epic E12 so the missing findings are traceable as sprint-scoped backlog items.
- `docs/WORKLOG.md`: appended one PLAN line for this pass.

Conflicts found and resolved:

1. The first corrective sprint draft said the wizard would be "done" after `S-43..S-47`, but explorer review showed several old frontend/backend semantics could still survive that plan.
   - Winner: code reality and explorer findings. The sprint is now patched so those semantics are explicitly removed or redefined.
2. The previous closeout artifact target reused an older site audit file unrelated to the wizard overhaul.
   - Winner: fit-for-purpose traceability. The sprint now calls for a wizard-specific re-audit artifact path.
3. The first corrective draft implied a final smoke, but it did not explicitly require the blocked-year branch or a human-readable sprint outcome.
   - Winner: user requirement. The final row now requires a fresh Finnish blocked-year audit and an explicit `succeeded` or `stopped by blocker` conclusion.

## PLAN pass update (bounded subagent delegation policy)

Date: 2026-03-12
Mode: PLAN

Why this pass ran:

- User requested that the repository OS explicitly support research-style subagents during PLAN and implementation-style subagents during DO/RUNSPRINT.

Changes in this pass:

- `AGENTS.md`: added bounded delegation rules. PLAN may use read-only research subagents for follow-up context only after the parent completes the required reads in order. DO/RUNSPRINT may use one implementation subagent for the currently selected substep only. The parent remains responsible for scope, commands, commits, evidence, worklog, and clean-tree checks.
- `docs/ROADMAP.md`: updated M0 contract hardening criteria to include bounded subagent delegation.
- `docs/BACKLOG.md`: recorded and closed the research-subagent and implementation-subagent hardening tasks.
- `docs/SPRINT.md`: aligned the execution header with the new PLAN and DO/RUNSPRINT subagent policy.
- `docs/PROJECT_STATUS.md`: refreshed the snapshot and next actions to reflect the hardened OS contract.
- `docs/DECISIONS.md`: appended ADR-030 for bounded subagent delegation.
- `docs/WORKLOG.md`: append one PLAN line for this pass.

Conflicts found and resolved:

1. The user wanted subagent delegation, but the existing OS contract had no ownership boundary for commits, evidence, or clean-tree enforcement.
   - Winner: existing deterministic DO/REVIEW guarantees. Subagents are now explicitly helpers only; the parent agent remains accountable for protocol compliance.
2. PLAN could benefit from research subagents, but required reads in order must remain non-delegable.
   - Winner: PLAN required-read order. Research subagents may assist only with follow-up context gathering and must not replace the parent's canonical reads.
3. RUNSPRINT could otherwise imply whole-sprint parallelization.
   - Winner: deterministic single-substep execution. DO/RUNSPRINT may use at most one implementation subagent for the currently selected substep and may not run multiple substeps in parallel.

## PLAN pass update (delegation launcher wording and read-order normalization)

Date: 2026-03-12
Mode: PLAN

Why this pass ran:

- User requested explicit wording so the repository OS could use a delegation launcher without creating a new protocol mode or weakening the bounded delegation rules added earlier in the day.

Changes in this pass:

- `AGENTS.md`: defined the then-current delegation launcher as the allowed launcher for the existing subagent slots, added explicit no-recursion / no-parallel-stream rules, required worktree-safe delegation artifacts, allowed PLAN follow-up research through that launcher, bounded DO/RUNSPRINT to one selected-substep launcher run, and kept REVIEW parent-owned unless a future ADR says otherwise.
- `docs/CANONICAL.md`: added tool-specific canonical wording and normalized the read-order section so protocol-required ordering follows `AGENTS.md`.
- `docs/ROADMAP.md`, `docs/BACKLOG.md`, `docs/SPRINT.md`, and `docs/PROJECT_STATUS.md`: aligned milestone, backlog, sprint-header, and status wording to that historical delegation contract.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. Existing docs allowed bounded subagent delegation generically, but never named the then-current launcher, which left ambiguity about recursion, artifact location, and REVIEW usage.
   - Winner: the existing bounded-subagent model in `AGENTS.md`. The launcher was treated as a wrapper for the existing PLAN and DO/RUNSPRINT slots, not as a separate mode.
2. `docs/CANONICAL.md` listed a read order that conflicted with the PLAN required-read order in `AGENTS.md`.
   - Winner: `AGENTS.md` for protocol-required ordering. `docs/CANONICAL.md` now explicitly defers to `AGENTS.md` and mirrors the default planning order.

## PLAN pass update (remove delegation/autopilot wording and prefer direct MCP tools)

Date: 2026-03-16
Mode: PLAN

Why this pass ran:

- The active repo/tooling setup no longer uses delegation or autopilot flows, but the repository OS still mentioned them in canonical docs.

Changes in this pass:

- `AGENTS.md`: added explicit preference for direct MCP tools (`filesystem`, `git`, `github`, `context7`, `chrome-devtools`, `playwright`) and made clear that delegation/autopilot tooling is not part of the repo's active operating contract.
- `docs/CANONICAL.md`: removed the tool-specific delegation wording and aligned the top-level contract text with direct MCP usage.
- `docs/ROADMAP.md`, `docs/BACKLOG.md`, and `docs/SPRINT.md`: replaced remaining delegation/autopilot references with bounded native helper wording plus direct MCP preference.

Conflicts found and resolved:

1. The repo still had active contract text for a delegation toolchain that is no longer part of the working setup.
   - Winner: the current runtime reality. Active docs now describe native helper-agent behavior and direct MCP usage instead of delegation/autopilot flows.

## PLAN pass update (parent-first helper bias)

Date: 2026-03-16
Mode: PLAN

Why this pass ran:

- The repo OS still permitted helper-agent usage broadly enough that it could become the default behavior even when it would slow execution through coordination overhead.

Changes in this pass:

- `AGENTS.md`: added an explicit parent-first execution bias in Global rules.
- `AGENTS.md`: tightened PLAN helper use so read-only helper research is only for clearly parallelizable follow-up context.
- `AGENTS.md`: tightened DO helper use so the parent remains preferred for small or tightly coupled packets.

Conflicts found and resolved:

1. The OS allowed bounded helper use, but that alone does not say whether helpers are the exception or the norm.
   - Winner: speed and protocol simplicity. The active bias is now parent-first, with helpers used only when they clearly reduce wall-clock time.

## PLAN pass update (wizard UX coherence sprint S-48..S-52)

Date: 2026-03-15
Mode: PLAN

Why this pass ran:

- The corrective wizard sprint `S-43..S-47` now passes functionally, but a fresh live UX audit found a second-tier consistency gap across the wizard, shell, Forecast, and Reports.
- The concrete findings were: the active form is visually below non-actionable hero chrome on step 1, shell connection and tab-lock truth can lag behind the wizard on direct routes and after clear/reset, human-facing year counts still mix available and imported semantics, step 2 combines importable and repair-only years in one main list, the summary rail duplicates too much of the task narrative, and the Forecast/Reports handoff still feels like a second onboarding phase.

Changes in this pass:

- `docs/SPRINT.md`: replaced the completed `S-43..S-47` queue with a new executable UX-coherence queue `S-48..S-52`:
  - `S-48` shell truth and route-safe locking
  - `S-49` imported-year-only human semantics
  - `S-50` action-first step layout and summary demotion
  - `S-51` Forecast/Reports handoff smoothing
  - `S-52` final UX consistency proof and audit artifact
- `docs/ROADMAP.md`: updated M0 execution-target wording from corrective wizard completion to the post-closure UX-coherence queue.
- `docs/PROJECT_STATUS.md`: replaced the “no active execution blocker” snapshot with the new UX-coherence blockers and next actions.
- `docs/BACKLOG.md`: marked Epic E12 items as done and added Epic E13 for the follow-up UX-consistency work.
- `docs/DECISIONS.md`: appended ADR-032 to lock the action-first/task-truth principle for the wizard and shell.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. `docs/SPRINT.md` was complete, but the live browser audit still found a set of real user-facing inconsistencies.
   - Winner: live code reality and browser audit. The product is functionally complete but still needs a new active sprint for human-facing coherence.
2. Current shell/header chrome can imply a stronger connection/readiness state than the wizard itself.
   - Winner: wizard truth. The next sprint now treats shell truth as the first dependency rather than a cosmetic follow-up.
3. Current Overview summary counts and step-2 list membership mix available VEETI years with imported workspace years.
   - Winner: imported-workspace truth. The next sprint now explicitly separates discovery-only years from imported and ready years in human-facing UI.

## PLAN pass update (power-user Forecast/resultatrakning queue S-53..S-58)

Date: 2026-03-15
Mode: PLAN

Why this pass ran:

- User requested that the new power-user `Ennuste` direction be converted into actual executable sprint work, based on the current code rather than on a greenfield redesign.
- Supporting customer materials confirmed the planning frame: three latest result statements as the base, summary-level planning lines, and depreciation calculated separately from baseline plus a 20-year investment plan and depreciation rules.

Changes in this pass:

- `docs/ROADMAP.md`: updated the M0 execution-target wording from the completed wizard UX-coherence queue to a new power-user Forecast/resultatrakning queue.
- `docs/PROJECT_STATUS.md`: replaced the generic “select the next queue” snapshot with concrete blockers and next actions for the power-user Forecast refactor.
- `docs/BACKLOG.md`: marked Epic E13 complete and added Epic E14 for the power-user cockpit, scenario-specific depreciation migration, mapping, comparison, and audit work.
- `docs/SPRINT.md`: appends a new executable queue `S-53..S-58` based on current code reality:
  - `S-53` Forecast status truth and command strip
  - `S-54` resultatrakning-first cockpit
  - `S-55` pillar drill-down editing and dense mode
  - `S-56` depreciation contract migration from org-level to scenario-level
  - `S-57` `Avskrivningar` workspace with baseline/new split and one-to-one investment mapping
  - `S-58` statement-native comparison and final power-user audit
- `docs/DECISIONS.md`: appended ADR-033 to lock the five planning pillars and the scenario-specific depreciation direction.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. Current Forecast code already supports depreciation rules, but they are organization-level rather than scenario-specific.
   - Winner: customer planning direction and statement model. The new sprint explicitly includes a migration step instead of pretending the current contract already matches the target.
2. Current Forecast IA is form/driver-first, while the customer and supporting materials prioritize result statement structure.
   - Winner: customer materials and planning goal. The new queue starts by reframing the selected-scenario landing area into a resultatrakning-first cockpit.
3. A supporting non-canonical plan draft exists as pre-PLAN dirt (`docs/ENNUSTE_POWER_USER_RESULTATRAKNING_PLAN.md`), but it is not an allowed PLAN output file.
   - Winner: PLAN file-permission rules. The draft was used as input context and intentionally left outside the PLAN commit.

## PLAN pass update (wizard trust-first queue S-59..S-63)

Date: 2026-03-16
Mode: PLAN

Why this pass ran:

- A fresh live wizard audit after reset showed that the current wizard is structurally cleaner than the old Overview flow but still fails the core trust test for low-frequency users.
- The confirmed problems are:
  1. step 1 still requires explicit search instead of assisted lookup,
  2. technically ready years are treated as effectively approved even though their contents are not exposed,
  3. ready years are less reviewable than blocked years,
  4. the current year editor is overloaded and leads with effective-state editing instead of VEETI-baseline review.

Changes in this pass:

- `docs/SPRINT.md`: rotated the active queue to `S-59..S-63` for wizard trust-first work:
  - `S-59` assisted org lookup and backend-safe search hardening
  - `S-60` separate technical readiness from human review state
  - `S-61` trustworthy year cards with recognizable value previews and actions
  - `S-62` shared year-detail review/edit surface with raw-vs-effective visibility and section restore paths
  - `S-63` final regressions and a fresh wizard trust audit artifact
- `docs/ROADMAP.md`: updated the M0 execution-target wording from the accepted Forecast queue to the new wizard trust-first queue.
- `docs/PROJECT_STATUS.md`: replaced the post-Forecast rotation placeholder with the live-audit trust blockers and next actions.
- `docs/BACKLOG.md`: added Epic E15 so the new wizard-trust tasks remain traceable outside the sprint rows.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. `docs/WIZARD_UX_CONSISTENCY_AUDIT.md` concluded `whole sprint succeeded`, but the newer 2026-03-16 live audit found real wizard trust gaps.
   - Winner: newer live audit plus current code reality. The earlier audit remains true for the narrower UX-coherence scope it measured; the new queue targets the still-open trust/review problems.
2. The current wizard labels `Valmis` years through sync-readiness checks alone, while the customer requirement doc says annual reports are the base, account-group mapping must be updatable per year, and users must work from recognizable yearly financial structure.
   - Winner: customer requirement plus current live audit. The new queue separates technical completeness from human review and makes every imported year reviewable/editable.
3. Initial concern said autocomplete might be blocked by a public API, but code reality shows search is tenant-authenticated app backend traffic, not a direct public-browser VEETI call.
   - Winner: code reality. Assisted lookup is in scope, with backend reliability hardening planned alongside the UI change.

## PLAN pass update (wizard review-loop completion queue S-64..S-68)

Date: 2026-03-16
Mode: PLAN

Why this pass ran:

- Current planning docs marked `S-59..S-63` done, but a fresh local live audit against the current code found that the wizard review loop is still incomplete.
- The concrete failures were:
  1. technically ready years cannot be approved as-is without an edit,
  2. ready-year copy still reads like a problem-year flow,
  3. some year-detail strings still fall back to English,
  4. blocked-year missing values still appear as zero-like business values,
  5. the shared year-detail surface exposes too much editing/power-user detail too early for a normal review pass.

Changes in this pass:

- `docs/SPRINT.md`: rotated the active queue to `S-64..S-68` with a more code-grounded follow-up plan:
  - `S-64` no-change review acceptance and reviewed-state progression
  - `S-65` review-mode-first ready-year copy and edit-mode separation
  - `S-66` locale parity and missing-state presentation cleanup
  - `S-67` human-first review layering plus coherent auto-advance
  - `S-68` final regressions and a fresh wiped-workspace steps `1..6` audit artifact
- `docs/ROADMAP.md`: updated the M0 execution target from the accepted trust-first queue to the current review-loop completion queue.
- `docs/PROJECT_STATUS.md`: replaced the “no active blocker remains” snapshot with the new review-loop blockers grounded in current code and the fresh live audit.
- `docs/BACKLOG.md`: added Epic E16 so the new follow-up tasks remain traceable beyond the sprint rows.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. Current planning docs say the wizard trust-first queue succeeded, but the current code still leaves `handleKeepCurrentYearValues()` as a no-op that never marks a year reviewed.
   - Winner: current code reality and fresh live audit. The next queue is now grounded on the actual implementation seams rather than on the earlier acceptance snapshot alone.
2. Current shared year-detail surface usefully exposes VEETI-vs-current comparisons, but it still frames technically ready years with problem-year wording and falls back to English for some keys.
   - Winner: human-facing trust requirement. The new queue separates ready-year review semantics from blocked-year repair semantics and treats locale parity as part of trust, not as optional polish.
3. Current blocked-year cards show zero-like prices and volumes when data is missing, which can be read as real business values.
   - Winner: human-facing truthfulness. The follow-up queue explicitly reworks missing-state presentation instead of treating it as acceptable fallback UI.

## PLAN pass update (wizard year-card accounting queue S-69..S-73)

Date: 2026-03-16
Mode: PLAN

Why this pass ran:

- The latest customer direction refined what the wizard cards must optimize for: the same accounting rows that matter on `Ennuste`, and a human sanity check based on raw income/cost/result structure rather than inferred badges.
- Current code still foregrounds `Liikevaihto`, prices, and volumes on step-2 cards and labels technically importable VEETI years too strongly.
- Current imported-year data also does not directly expose a distinct `Materialkostnader` field, so the next queue must be honest about the mapping/contract work needed to align the cards to the customer’s model.

Changes in this pass:

- `docs/SPRINT.md`: rotates the active queue to `S-69..S-73`:
  - `S-69` add a truthful import-year summary model aligned to the customer’s planning rows
  - `S-70` rebuild step-2 cards around that accounting model and remove over-strong readiness semantics
  - `S-71` mirror the same accounting structure in step-3 review cards and keep year inspection/edit entry points truthful
  - `S-72` demote low-value technical helper text and keep raw economic validation primary without inferred badges
  - `S-73` close with a fresh audit against the original setup-scope lock
- `docs/ROADMAP.md`: updates the M0 execution target from the accepted review-loop queue to the new year-card accounting queue.
- `docs/PROJECT_STATUS.md`: replaces the review-loop blocker snapshot with the current import-card/accounting-model blockers.
- `docs/BACKLOG.md`: adds Epic E17 for traceability.
- `docs/DECISIONS.md`: appends ADR-034 to lock the customer-facing rule that wizard cards show raw accounting structure rather than inferred correctness.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. The current wizard import cards foreground `Liikevaihto`, prices, and volumes, but the customer now explicitly says the key planning rows are `Intakter`, `Materialkostnader`, `Personalkostnader`, and `Ovriga rorelsekostnader`.
   - Winner: customer direction plus client requirement doc. The next queue reorients the cards to the customer’s accounting model instead of keeping the earlier preview trio as the primary summary.
2. The product could infer “near zero” or similar health badges from the raw numbers, but the customer explicitly rejected that approach.
   - Winner: customer direction. The new queue shows raw accounting rows and result values only; it does not add interpretive badges.
3. The current import-year data shape does not directly provide a separate `Materialkostnader` field.
   - Winner: code reality. The queue explicitly includes summary-model/contract work rather than pretending the cards can be switched by copy-only changes.

## PLAN pass update (comprehensive frontend-overhaul queue S-74..S-85)

Date: 2026-03-16
Mode: PLAN

Why this pass ran:

- User explicitly requested a `PLAN` run that turns the approved frontend canon into an executable implementation queue in `docs/SPRINT.md`.
- The previous active queue `S-69..S-73` completed, but the current product still has broader trust, statement-import, Forecast, and depreciation UX gaps than that narrow queue covered.
- Customer source material plus the live audit of the real 2024 statement PDF confirmed that the remaining work is an end-to-end frontend overhaul, not another small wizard-only follow-up.

Changes in this pass:

- `docs/SPRINT.md`: replaced the old queue with a new comprehensive active queue `S-74..S-85` covering shell truth, trust-first intake, full manual override, first-class statement-PDF correction, strict planning-baseline gating, CFO-first Forecast landing, progressive investment planning, integrated depreciation strategy, Reports provenance alignment, accessibility/locale finish, and final live proof.
- `docs/ROADMAP.md`: updated M0 execution-target wording from the accepted `S-69..S-73` queue to the new frontend-overhaul queue.
- `docs/PROJECT_STATUS.md`: replaced the narrow card-alignment snapshot with the broader frontend-overhaul blockers and next actions.
- `docs/BACKLOG.md`: added Epic E18 so the comprehensive overhaul remains traceable outside the sprint rows.
- `docs/DECISIONS.md`: appended ADR-035 to lock the execution pivot to a full frontend overhaul across wizard, statement correction, Forecast, and Reports.

Conflicts found and resolved:

1. The old active planning docs still described the next gap as a narrow import/review card problem.
   - Winner: newer live audit evidence, customer materials in `docs/client/*`, and the approved frontend canon. The active queue is now the broader frontend-overhaul plan.
2. The approved UI canon currently exists as a pre-PLAN untracked file (`docs/UI_OVERHAUL_CANONICAL_PLAN.md`), but PLAN outputs are restricted to canonical planning docs.
   - Winner: PLAN file-permission rules. The new queue absorbed that canon into `docs/ROADMAP.md`, `docs/BACKLOG.md`, `docs/SPRINT.md`, `docs/PROJECT_STATUS.md`, and `docs/DECISIONS.md` without staging the pre-existing untracked file in the PLAN commit.
3. The customer PDF audit proved statement correction is a real product path, but the old planning docs still treated it as secondary to the wizard card queue.
   - Winner: live product evidence. Statement-PDF correction is now part of the core frontend-overhaul execution target and final audit criteria.

## PLAN pass update (`Yhteenveto` perfection queue S-87..S-92)

Date: 2026-03-17
Mode: PLAN

Why this pass ran:

- User explicitly requested a `PLAN` run that converts the latest `Yhteenveto` perfection spec into a comprehensive implementation queue in `docs/SPRINT.md`.
- The previous active queue through `S-86` is complete, so a new active sprint row set is required before any more protocol-compliant `DO` work can continue.
- The new customer clarifications are narrower and stricter than the broader frontend-overhaul canon: direct `AineetJaPalvelut`, no fallback split, 5 canon line items plus `Tulos`, literal warnings, inline whole-card editing, secondary price/volume stats, and a final audit proving the cards behave exactly that way.

Changes in this pass:

- `docs/SPRINT.md`: replaced the completed active queue with a new `Yhteenveto` perfection queue `S-87..S-92` focused on the year-card data contract, card layout, inline editing, step-3 parity, language/zero-missing polish, and a final audit row.
- `docs/ROADMAP.md`: updated the M0 execution target from the completed broad frontend-overhaul queue to the new `Yhteenveto` perfection queue.
- `docs/PROJECT_STATUS.md`: replaced the �no active row remains� snapshot with `Yhteenveto`-specific blockers and next actions.
- `docs/BACKLOG.md`: added Epic E19 for traceability of the one-sprint `Yhteenveto` perfection work.
- `docs/DECISIONS.md`: appended ADR-036 to lock the `Yhteenveto` card model, the direct `AineetJaPalvelut` rule, the inline card editing rule, and the no-fake-subrows rule.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. The previous planning docs correctly said the broader frontend-overhaul queue was complete, but the user then narrowed the next request to a single-sprint `Yhteenveto` perfection pass.
   - Winner: latest explicit user instruction. The active queue is now intentionally narrower than the just-finished overhaul queue.
2. The temp spec file (`docs/tmp_YHTEENVETO_PERFECTION_PLAN.md`) exists as pre-PLAN context, but PLAN outputs are restricted to canonical planning docs.
   - Winner: PLAN file-permission rules. The new queue absorbed that temp spec into `docs/ROADMAP.md`, `docs/BACKLOG.md`, `docs/SPRINT.md`, `docs/PROJECT_STATUS.md`, and `docs/DECISIONS.md` without staging the pre-existing temp file in the PLAN commit.
3. The user asked for subrow expansion only when truthful source data exists, while current code still works mainly from summary-level fields.
   - Winner: code reality plus user rule. The sprint now includes explicit discovery/locking of subrow availability and forbids fake subrow expansion if the real data is not available.

## PLAN pass update (step-2 modernization and QDIS import queue S-93..S-98)

Date: 2026-03-17
Mode: PLAN

Why this pass ran:

- User explicitly requested a `PLAN` run that turns the latest human audit findings and agreed fixes into the active sprint queue in `docs/SPRINT.md`.
- The previous `Yhteenveto` perfection queue `S-87..S-92` is complete, but the new audit found still-open step-2/task-hierarchy, visual-trust, direct-repair, and QDIS-import gaps.
- Client-source docs still ground the product on three-year result-statement baselines, editable yearly prices/volumes, and 20-year investment/depreciation logic, so the next queue must stay aligned to that model instead of becoming a purely cosmetic redesign.

Changes in this pass:

- `docs/SPRINT.md`: replaced the completed queue with a new active queue `S-93..S-98` covering step-2 copy/layout simplification, trust-board restyling, direct price/volume repair from the cards, per-year QDIS PDF import, explicit wizard-year provenance, and final live proof with the customer's 2022 QDIS PDF.
- `docs/ROADMAP.md`: updated the M0 execution-target wording from the completed `Yhteenveto` queue to the new year-intake modernization and QDIS-import queue.
- `docs/PROJECT_STATUS.md`: replaced the closed-sprint snapshot with the new step-2/task-hierarchy, visual-trust, and QDIS-import blockers and next actions.
- `docs/BACKLOG.md`: marked Epic E19 done and added Epic E20 for traceability of the new queue.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. Current code already has `bokslut PDF` OCR, but the requested feature is per-year QDIS PDF import for prices and volumes.
   - Winner: current code reality plus latest user instruction. The new queue reuses the existing year-patch path but adds a separate QDIS import flow instead of pretending the shipped `bokslut` OCR already satisfies the requirement.
2. The current step-2 helper rail communicates setup context, but the audit shows it suppresses the primary task and creates dead space.
   - Winner: human-facing task clarity. The new queue makes the year-selection board the first visible task and demotes helper chrome to compact supporting context.
3. Missing prices and volumes are technically editable today, but the UI hides the repair path behind generic manual-edit mode and weak affordances.
   - Winner: audit reality. The new queue requires direct repair affordances from the year cards themselves rather than relying on hidden capability.

## PLAN pass update (Excel selective override and investment-plan queue S-99..S-106)

Date: 2026-03-18
Mode: PLAN

Why this pass ran:

- User explicitly requested a `PLAN` run that turns the temporary implementation spec into the next canonical execution queue.
- Live Kronoby verification after the QDIS sprint clarified the real next problem: the customer workbook is a trustworthy multi-year repair source for shared financial rows, while the 2024 statement PDF is a stronger year-specific finance source and not a one-line patch.
- The customer also clarified that the future-planning workbook (`Investeringsplan PTS.xlsx`) should shape a small-utility-friendly investment and depreciation entry flow in Ennuste.

Changes in this pass:

- `docs/SPRINT.md`: replaced the old active queue with a new queue `S-99..S-106` covering workbook provenance, workbook compare/apply, Kronoby `2022..2024` repair, explicit 2024 merge truth, operator-friendly `Investointiohjelma`, PTS-based `Poistosaannot`, impact wiring, and final live proof.
- `docs/ROADMAP.md`: updated the M0 execution target from the completed/blocked year-intake queue to the new selective-override plus investment-plan queue.
- `docs/PROJECT_STATUS.md`: replaced the QDIS-audit blocker snapshot with the current selective-override, 2024 merge, and investment-entry blockers.
- `docs/BACKLOG.md`: marked the implemented E20 tasks done, kept the blocked E20 audit item open, and added Epic E21 (historical-year selective override) plus Epic E22 (investment-plan entry).
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. The previous active queue ended with a blocked 2022 QDIS audit input, but the latest user instruction shifts the next execution target to workbook-driven historical repair plus investment planning.
   - Winner: latest explicit user instruction plus live audit evidence. The active queue now follows the workbook/PDF/PTS split rather than continuing the blocked audit queue.
2. The 2024 statement PDF could be treated as a one-line fix source or as a stronger full-year finance source.
   - Winner: live product evidence. The browser and API runs proved the PDF changes multiple 2024 finance rows, so the new queue plans explicit merge semantics rather than pretending it is only a missing-line repair.
3. Current customer docs provide a truthful multi-year source for the six shared financial rows and price references, but not one equally clear cross-year sold-volume import source.
   - Winner: source inspection. The first selective-override pass is intentionally limited to the six shared financial rows; workbook-driven sold-volume override remains out of this queue until a truthful source is proven.
4. Investment-plan entry could be placed at the end of setup or at the start of Ennuste.
   - Winner: task fit and customer workflow. Setup stays focused on source-baseline readiness, while `Investointiohjelma` and `Poistosaannot` move to the start of Ennuste where tariff and cash impact are immediately visible.

## PLAN pass update (CFO-readiness audit remediation queue S-113..S-120)

Date: 2026-03-19
Mode: PLAN

Why this pass ran:

- A fresh full dev-site audit covered the live wizard, Forecast, depreciation, report creation, and PDF export path.
- The accepted S-107..S-112 queue fixed real operator issues, but the live audit still found end-to-end CFO trust gaps:
  1. Step 3 can silently turn technically ready years into reviewed years.
  2. Years missing canon finance rows can still look baseline-eligible.
  3. The Poistosaannot path is powerful but still too technical and jargon-heavy.
  4. Mixed-language fallback and stale helper copy remain on primary surfaces.
  5. Forecast and Reports still carry hierarchy and accessibility debt.

Changes in this pass:

- docs/SPRINT.md: added the new active queue S-113..S-120 for wizard review truth, tightened year-readiness gating, mixed-language/stale-copy cleanup, smoother Forecast handoff, CFO-safe depreciation defaults/carry-forward, Poistosaannot UX simplification, Reports/Forecast trust polish, and a final reset-to-PDF CFO audit.
- docs/ROADMAP.md: updated M0 execution-target wording from the accepted S-99..S-112 hardening queue to the new CFO-readiness remediation queue.
- docs/PROJECT_STATUS.md: replaced the post-acceptance placeholder snapshot with the live-audit blockers and next actions.
- docs/BACKLOG.md: added Epic E23 so the audit-driven remediation work remains traceable outside the sprint rows.
- docs/WORKLOG.md: appends one PLAN line for this pass.

Conflicts found and resolved:

1. Current planning docs say the S-107..S-112 remediation queue passed, but the new live audit still found CFO-facing trust gaps.
   - Winner: newer live audit evidence and current code reality. The accepted queue remains accepted for its narrower goals; the new queue addresses the remaining end-to-end CFO issues.
2. Current wizard logic treats technical readiness as close enough to human approval during Step 3 continuation.
   - Winner: customer requirement doc plus live audit. A year now needs explicit operator approval before it should count as reviewed or baseline-ready.
3. Current Forecast already supports advanced depreciation methods in the compute engine, but the primary UX still exposes mixed internal or legacy wording and too much manual mapping friction.
   - Winner: customer-facing workflow fit. The next queue keeps the current compute contract but plans simpler defaults, carry-forward assistance, and clearer finance-language framing instead of another engine rewrite.
## PLAN pass update (current-state UI overhaul queue S-121..S-127)

Date: 2026-03-19
Mode: PLAN

Why this pass ran:

- User explicitly requested a PLAN run that turns the approved UI/look direction into a protocol-compliant sprint.
- The current repo was re-checked against customer docs and current frontend/backend code before planning.
- Customer source material still anchors the product on three real result-statement base years, 20-year investment planning, explicit pricing/result experimentation, and depreciation derived from the freshest booked year plus future investments.

Changes in this pass:

- docs/SPRINT.md: added the new active queue S-121..S-127 for shared visual tokens and shell chrome, trust-first login, Overview pending-review and accepted-years states, chart-first Forecast, document-grade Reports, and final responsive/live audit proof.
- docs/ROADMAP.md: updated the M0 execution-target wording from the accepted CFO queue to the current UI overhaul queue and added a visual-system done criterion tied to current workflow truth.
- docs/PROJECT_STATUS.md: replaced the post-CFO closed-queue snapshot with the new UI implementation target and execution guardrails.
- docs/BACKLOG.md: marked Epic E23 done and added Epic E24 so the visual overhaul remains traceable outside the sprint rows.
- docs/WORKLOG.md: appends one PLAN line for this pass.

Conflicts found and resolved:

1. Manual redesign notes and mockups already exist as pre-PLAN untracked files, but PLAN outputs are restricted to canonical planning docs.
   - Winner: PLAN file-permission rules. Canonical docs absorb the approved direction into executable rows; the ad-hoc notes remain outside the PLAN commit baseline.
2. The user asked for a "complete new UI/look", but customer docs and current backend still require visible year approval, provenance, freshness, depreciation, and report-readiness truth.
   - Winner: customer docs plus current code reality. The new queue is a visual reset, not a behavior simplification.
3. Recent repo changes touched mostly frontend state handling and only minor backend proof, so the queue could either reopen backend contracts or stay front-end-led.
   - Winner: current code evidence. Backend/schema changes are not planned by default; the frontend work must preserve current backend-driven states and only widen to same-area contract support if execution proves a real gap.

## PLAN pass update (post-audit wizard interaction/performance queue S-128..S-136)

Date: 2026-03-20
Mode: PLAN

Why this pass ran:

- User explicitly requested a comprehensive sprint implementation plan from the latest manual audit findings after the accepted `S-121..S-127` visual queue.
- Live browser findings and follow-up screenshots showed the remaining issues are interaction truth, selection semantics, and load behavior rather than another broad visual reset.
- Customer source material still anchors the product on three real result statements, per-year review and correction, editable price and volume assumptions, and 20-year planning with explicit depreciation.

Changes in this pass:

- `docs/SPRINT.md`: added the new active queue `S-128..S-136` for login refinement, wizard back navigation, faster step-1 lookup/connect, clearer step-2 lane semantics, in-place year-card editing in steps 2 and 3, value-led review summaries, bounded load/performance work, and final live proof.
- `docs/ROADMAP.md`: updated the M0 execution-target wording from the accepted `S-121..S-127` queue to the new post-audit interaction/performance queue.
- `docs/PROJECT_STATUS.md`: replaced the closed visual-queue snapshot with the current interaction, selection, and performance blockers.
- `docs/BACKLOG.md`: marked Epic E24 done and added Epic E25 for traceability of the new queue.
- `docs/DECISIONS.md`: appended ADR-041 to lock the new interaction-model assumptions.
- `docs/WORKLOG.md`: appended one PLAN line for this pass.

Conflicts found and resolved:

1. Current planning docs still named `S-121..S-127` as the active target, but those rows are already `DONE` and newer audit evidence found workflow issues beyond the visual reset.
   - Winner: newer audit evidence and current sprint state. The active target becomes `S-128..S-136`.
2. Current wizard logic allows technically selectable years with visible missing main-row values, while the UI and audit expectation read those values as warnings that should drive selection and parking behavior.
   - Winner: human-facing trust requirement, bounded by current contract reality. The new queue separates parked vs blocked semantics and tightens missing-value presentation and selection behavior.
3. The current detached under-card editor and explicit `Spara arsdata` flow are the only save path in code today, but the desired workflow is click row -> edit in place -> `Enter` save while keeping manual provenance.
   - Winner: interaction fit plus the existing backend manual-patch contract. The new queue reuses current manual provenance storage instead of planning a new schema.

## PLAN pass update (residual interaction-truth queue S-137..S-141)

Date: 2026-03-20
Mode: PLAN

Why this pass ran:

- User asked for one more planning pass to verify that the current implementation plan truly covers the earlier audit findings.
- The current sprint `S-128..S-136` is already implemented and marked `DONE`, so the remaining work must be planned as a focused follow-up queue instead of pretending the earlier queue is still active.
- A fresh browser-plus-code audit on the current app showed smaller but still meaningful residual gaps: step-2 editing is not yet row-local, step 3 still opens a secondary review surface, row save still over-refreshes the step, linked-workspace prefetch still reaches non-visible future years, and login environment metadata still competes too strongly with the sign-in task.

Changes in this pass:

- `docs/SPRINT.md`: appended the new residual queue `S-137..S-141` after the completed `S-128..S-136` rows.
- `docs/ROADMAP.md`: updated the active M0 execution target from the accepted `S-128..S-136` queue to the new residual interaction-truth queue.
- `docs/PROJECT_STATUS.md`: replaced the now-stale `S-128..S-136` blocker snapshot with the current residual blockers.
- `docs/BACKLOG.md`: marked Epic E25 effectively done and added Epic E26 for the residual cleanup queue.
- `docs/DECISIONS.md`: appended ADR-042 to lock the narrower follow-up direction.
- `docs/WORKLOG.md`: appended one PLAN line for this pass.

Conflicts found and resolved:

1. The current sprint rows `S-128..S-136` claim the interaction problems are solved, but the fresh live audit still shows the remaining editor-shape and linked-workspace-fetch gaps.
   - Winner: current code reality plus fresh browser evidence. The residual queue is planned explicitly instead of treating the prior queue as still-open.
2. The product already has in-place save, parked years, value-led review summaries, and back navigation, so a broad rewrite would duplicate the just-finished work.
   - Winner: minimal residual planning. The new queue is intentionally narrow and only targets what the live app still gets wrong.
3. Fresh-org timing improved under `S-134`, but the current linked workspace still fetches non-visible future-year detail on Overview load.
   - Winner: broader runtime truth. The residual queue adds linked-workspace prefetch bounding instead of calling `S-134` incomplete overall.

## PLAN pass update (OverviewPageV2 decomposition queue S-142..S-148)

Date: 2026-03-21
Mode: PLAN

Why this pass ran:

- User explicitly requested a comprehensive refactor plan for `apps/web/src/v2/OverviewPageV2.tsx`.
- The residual cleanup queue `S-137..S-141` is fully accepted, so a new active sprint target is required before any more protocol-compliant DO work can continue.
- Current code reality shows `OverviewPageV2.tsx` is still about 8.7k lines and mixes too many responsibilities for safe iteration.

Changes in this pass:

- `docs/SPRINT.md`: added the new active queue `S-142..S-148` for pure-helper extraction, orchestration-hook extraction, manual patch workflow extraction, step-component extraction, page-shell reduction, and final regression/live-audit proof.
- `docs/ROADMAP.md`: updated the M0 execution-target wording from the completed residual queue to the new behavior-preserving decomposition queue.
- `docs/PROJECT_STATUS.md`: replaced the residual blocker snapshot with the current structural blockers around `OverviewPageV2.tsx`.
- `docs/BACKLOG.md`: marked Epic E26 done and added Epic E27 for traceability of the decomposition work.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. The previous active planning target was a user-facing residual cleanup queue, but that queue is already fully `DONE`.
   - Winner: current sprint state. The active target becomes structural refactoring rather than inventing more UX cleanup work.
2. `OverviewPageV2.tsx` is a strong refactor candidate, but the just-accepted linked-workspace/setup behavior cannot be reopened casually.
   - Winner: behavior-preserving refactor scope. The new queue extracts structure without treating accepted wizard behavior as negotiable.
3. Some logic in `OverviewPageV2.tsx` overlaps with existing pure modules such as `yearReview.ts` and `overviewWorkflow.ts`.
   - Winner: code reality. The new queue extracts only what still belongs in the page today and reuses existing modules where they already own the right logic.


## PLAN pass update (security and performance remediation queue)

Date: 2026-03-21
Mode: PLAN (docs-only)

Why this pass ran:

- The user requested a concrete implementation plan for the latest security and performance audit findings and asked to land that plan in `docs/SPRINT.md`.

What changed:

- `docs/ROADMAP.md`: kept M0 active, marked the `S-142..S-148` decomposition queue as accepted context, and switched the current execution target to the security/performance remediation queue `S-149..S-156`.
- `docs/PROJECT_STATUS.md`: replaced the completed refactor queue snapshot with the new security/performance target, blockers, and next actions.
- `docs/BACKLOG.md`: added Epic `E28` covering upload hardening, trusted-IP/shared throttling, demo-secret cleanup, auth/legal query reduction, bundle/header hardening, release-gate checks, and re-audit.
- `docs/SPRINT.md`: replaced the active sprint goal/decisions and appended executable rows `S-149..S-156` with concrete file scopes, acceptance targets, stop conditions, and substeps.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. The active planning docs still pointed at the completed `S-142..S-148` refactor queue as the current target.
   - Winner: latest audit evidence plus the user's planning request. The refactor queue remains accepted history; the active queue is now the audit remediation pass.
2. `docs/client/Bokslut reviderad 2024.pdf` is image-based in this environment and did not yield extractable text through `pypdf`.
   - Resolution: this pass grounded the queue in the readable customer `.docx` and `.xlsx` sources plus local code/audit evidence, and treated the PDF as supporting but non-blocking input for planning.

## PLAN pass update (HUMANAUDIT intake protocol)

Date: 2026-03-21
Mode: PLAN (docs-only)

Why this pass ran:

- The user requested that the repo OS contract gain a screenshot/text-led audit intake protocol, but only through an explicit `PLAN` run.
- The requested flow needed to preserve the existing separation between read-only planning intake, canonical sprint writing, and later execution.

What changed:

- `AGENTS.md`: added a session-scoped read-only `HUMANAUDIT` protocol, explicit `OK GO` freeze behavior, `CANCEL` exit behavior, bounded read-only explorer use, and a `PLAN` handoff rule that keeps canonical writes inside `PLAN`.
- `docs/CANONICAL.md`: updated the top-level operating-contract references so `HUMANAUDIT` is part of the canonical repo OS contract.
- `docs/ROADMAP.md`: expanded M0 done criteria to include deterministic `HUMANAUDIT -> OK GO -> PLAN` behavior.
- `docs/BACKLOG.md`: added and closed `B-117` so the new protocol remains traceable in Epic E1.
- `docs/SPRINT.md`: added top-level policy text that `HUMANAUDIT` is read-only and that `OK GO` does not write sprint docs directly.
- `docs/PROJECT_STATUS.md`: updated the snapshot to reflect the new intake lane and the current `S-156` deployment-side blocker.
- `docs/DECISIONS.md`: appended ADR-043 to lock the HUMANAUDIT boundary.
- `docs/WORKLOG.md`: appended one PLAN line for this pass.

Conflicts found and resolved:

1. The requested workflow asked `OK GO` to both synthesize the findings and populate `docs/SPRINT.md`, but the existing repo contract keeps canonical doc writes inside `PLAN`.
   - Winner: existing PLAN write boundary. `OK GO` now freezes and synthesizes in chat only; a later `PLAN` run remains the only canonical writer.
2. The requested workflow wanted explorer-led localization for incoming screenshots/text, but spawning a helper on every fragment would add coordination noise and duplicate context gathering.
   - Winner: parent-led intake with bounded read-only explorer use only when new evidence materially changes localization needs or when distinct frontend/backend localization questions can be parallelized.
3. The current mode router is message-local, while the requested audit flow needs continuity across multiple user messages.
   - Winner: session-scoped `HUMANAUDIT` state that persists until `OK GO`, `CANCEL`, or an explicit switch to another protocol.

## PLAN pass update (HUMANAUDIT frontend trust and interaction queue S-157..S-162)

Date: 2026-03-22
Mode: PLAN (docs-only)

Why this pass ran:

- The user completed a HUMANAUDIT session with `OK GO` and then requested a canonical planning pass.
- Fresh screenshot/video evidence showed that the current accepted wizard/login interaction state is still not good enough in live use even though the previous residual cleanup queue was accepted.
- The remaining `S-156` work is deployment-only header verification from outside this workspace, so a new locally executable queue is required if planning should stay truthful and actionable.

What changed:

- `docs/ROADMAP.md`: kept M0 active, marked `S-149..S-155` as accepted context, kept `S-156` as a deployment-only hold, and switched the current local execution target to the HUMANAUDIT-derived frontend trust/interaction queue `S-157..S-162`.
- `docs/PROJECT_STATUS.md`: replaced the security-only snapshot with the new mixed state: `S-156` still blocked by deployment access while the current local blockers are login copy/chrome, VEETI search flicker, overloaded step-2 cards, summary placement, chronology, and row-edit reliability.
- `docs/BACKLOG.md`: added Epic `E29` covering the HUMANAUDIT-derived login, search, support-rail, board-density, chronology, parked-year, row-edit, and result-signal cleanup items.
- `docs/SPRINT.md`: replaced the sprint goal/decisions with the new queue focus, inserted executable rows `S-157..S-162` ahead of the historical rows so the queue stays top-to-bottom executable, and appended concrete substeps for login, VEETI search, support rail, board simplification, row editing, result-signal truth, and re-audit.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. The active planning docs still implied the security/performance queue `S-149..S-156` was the sole current target, but `S-156` is not locally closable from this workspace because the missing proof is deployment-edge state.
   - Winner: current execution reality plus the user's HUMANAUDIT findings. `S-156` stays as a truthful deployment-only hold while `S-157..S-162` becomes the current local execution target.
2. The previous accepted residual cleanup queue `S-137..S-141` and the later decomposition queue `S-142..S-148` improved the wizard substantially, but fresh HUMANAUDIT evidence still shows trust-breaking gaps in login language, search stability, card hierarchy, chronology, and row-edit behavior.
   - Winner: fresh browser evidence plus current code reality. The new queue explicitly reopens those interaction/trust gaps instead of pretending the accepted earlier queues already solved them fully.
3. The current result signal model treats `TilikaudenYliJaama` as an explicit stored field, while the user expectation during inline finance edits is that the visible result and warning text stay coherent with the row values they just changed.
   - Winner: truth-first UX planning. The new queue keeps result semantics inside scope as an explicit interaction-truth task instead of assuming the current `/ 0` wording and stale post-edit signal are acceptable.

## PLAN pass update (login-language remediation row S-163)

Date: 2026-03-23
Mode: PLAN (docs-only)

Why this pass ran:

- The user rejected the shipped `S-157` outcome as still using the same workflow-jargon language on the login screen, especially in Swedish.
- Repo reality confirmed that the login still lacked the in-app language selector and still booted from persisted `va_language` instead of starting in Finnish.
- The sprint queue had already marked `S-157..S-162` `DONE`, so a follow-up execution row had to be appended explicitly before more protocol-compliant implementation work could continue.

What changed:

- `docs/ROADMAP.md`: updated the current locally executable target from the broader accepted queue `S-157..S-162` to the focused follow-up row `S-163`.
- `docs/PROJECT_STATUS.md`: replaced the broader local blocker summary with the specific login-language blocker: Finnish-first unauthenticated entry, login-screen language selector, and plain FI-first wording translated to SV/EN.
- `docs/BACKLOG.md`: appended `B-2912` and `B-2913` under Epic E29 to capture Finnish-first unauthenticated entry and login-screen language selector plus FI-led translation cleanup.
- `docs/SPRINT.md`: appended row `S-163` plus substeps for forced Finnish unauthenticated entry and login-screen language selector/copy rewrite.
- `docs/WORKLOG.md`: appends one PLAN line for this pass.

Conflicts found and resolved:

1. `S-157` was marked `DONE`, but current code still says things like imported years and planning baseline on the login screen and still lacks the login-screen language selector.
   - Winner: code reality plus the user's acceptance bar. The old row stays historical evidence, and `S-163` reopens only the insufficient login-language scope.
2. The app already has a working in-app language switcher and persisted manual language preference, but the user explicitly wants first open to start in Finnish before any manual change.
   - Winner: current customer direction for unauthenticated entry. `S-163` now makes Finnish-first startup part of the executable queue instead of treating persisted language as untouchable.
3. The previous broader queue `S-157..S-162` also covered search, board, rail, and result fixes that are already logged as accepted.
   - Winner: minimal corrective planning. This pass adds one focused follow-up row instead of reopening every previously accepted frontend fix.
