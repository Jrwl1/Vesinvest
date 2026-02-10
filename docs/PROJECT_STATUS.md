# Project status

Last updated: 2026-02-10

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- Core budget/import/projection flows exist and remain the V1 base.
- Customer-locked facts are now explicit: VAT-free, manual base fee, no dedicated connection-fee model, minimum 20-year horizon, depreciation split, PDF cashflow export.
- AI OS contract is being hardened so future runs can be triggered by PLAN/DO/REVIEW only.

## Top blockers

1. REVIEW blocker: S-01..S-05 remain `TODO` with placeholder Evidence, so Acceptance cannot be verified.
2. Customer-owned TBD items affect final acceptance lock, not day-to-day DO execution.
3. Any new unknowns must be logged as `B-TBD` before they can block execution.

## Next 5 actions

1. Execute S-01 via DO and replace placeholder Evidence with commit hash, changed file paths, and test output.
2. Execute S-02 via DO and replace placeholder Evidence with commit hash, changed file paths, and test output.
3. Execute S-03 via DO and replace placeholder Evidence with commit hash, changed file paths, and test output.
4. Execute S-04 via DO and replace placeholder Evidence with commit hash, changed file paths, and artifact/test output.
5. Execute S-05 via DO and replace placeholder Evidence with commit hash, changed file paths, and gate run output.

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
