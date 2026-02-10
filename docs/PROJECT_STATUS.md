# Project status

Last updated: 2026-02-10

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Core budget/import/projection flows exist and remain the V1 base.
- Customer-locked facts are now explicit: VAT-free, manual base fee, no dedicated connection-fee model, minimum 20-year horizon, depreciation split, PDF cashflow export.
- OS contract supports deterministic PLAN/DO/REVIEW execution.
- Sprint state after REVIEW: `S-01=IN_PROGRESS`; `S-02..S-05=TODO`.
- `S-01` substep 6 now has commit-form evidence (`12df429`), but substeps 1-5 evidence format is still non-conforming.

## Top blockers

1. Working tree dirty: `docs/SPRINT.md`, `docs/WORKLOG.md`.
2. `S-01` remains `IN_PROGRESS`; no sprint row is `READY`, so REVIEW cannot verify acceptance-to-`DONE`.
3. `S-01` checked substeps 1-5 still lack required `commit | run | files` evidence format.

## Next 5 actions

1. Normalize `S-01` checked substeps 1-5 evidence lines to `commit | run | files` format.
2. Keep `S-01` as `IN_PROGRESS` until all checked substeps satisfy the evidence format.
3. Move `S-01` to `READY` only after all six checked substeps satisfy commit-per-substep evidence.
4. Run REVIEW again once `S-01` is `READY` to verify acceptance and eligibility for `DONE`.
5. Start `S-02` only after `S-01` passes READY/DONE flow.

## Customer TBD tracking

Customer-owned unknowns are tracked in `docs/BACKLOG.md` as `B-TBD-01..B-TBD-05`.

## Key links

- `AGENTS.md`
- `docs/CANONICAL.md`
- `docs/CANONICAL_REPORT.md`
- `docs/ROADMAP.md`
- `docs/SPRINT.md`
- `docs/BACKLOG.md`
- `docs/DECISIONS.md`
