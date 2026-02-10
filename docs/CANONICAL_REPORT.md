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
