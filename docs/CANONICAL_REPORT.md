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
