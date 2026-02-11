# Project status

Last updated: 2026-02-11

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Core budget/import/projection flows exist and remain the V1 base.
- Customer-locked facts are now explicit: VAT-free, manual base fee, no dedicated connection-fee model, minimum 20-year horizon, depreciation split, PDF cashflow export.
- OS contract supports deterministic PLAN/DO/REVIEW execution.
- Sprint state after REVIEW: `S-01=DONE`; `S-02=DONE`; `S-03=DONE`; `S-04..S-05=TODO`.
- `S-02` acceptance verified from commit chain `61bde17..d40c48a` and focused regression runs (API budget 10 passed, API projection 17 passed, web panel 2 passed).

## Top blockers

1. No sprint row is currently `READY`; remaining active rows are `S-04..S-05` (`TODO`).
2. `S-04` and `S-05` still have `Evidence needed` for acceptance review.
3. Customer-owned TBD items `B-TBD-01..B-TBD-05` remain open for final acceptance lock.

## Next 5 actions

1. Execute `DO` for `S-04` substep 1 (add projection export endpoint contract for PDF response).
2. Continue `S-04` substeps sequentially with commit-per-substep evidence.
3. Move `S-04` to `READY` only after all substeps are checked with `commit | run | files`.
4. Run `REVIEW` on `S-04` once it becomes `READY` to verify acceptance for `DONE`.
5. Keep customer TBD clarifications (`B-TBD-01..B-TBD-05`) tracked for milestone acceptance.

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
