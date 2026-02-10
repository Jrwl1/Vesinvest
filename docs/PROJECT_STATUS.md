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
- Sprint state after REVIEW: `S-01=IN_PROGRESS`; `S-02..S-05=TODO` with evidence still pending.

## Top blockers

1. Working tree dirty: `AGENTS.md`, `apps/api/src/projections/projection-engine.service.ts`, `docs/SPRINT.md`, `docs/WORKLOG.md`.
2. No sprint row is `READY`, so REVIEW cannot verify acceptance-to-`DONE`.
3. `S-02..S-05` have `Evidence needed`; concrete commit/test/artifact evidence is required in DO runs.

## Next 5 actions

1. Run `DO` for the next unchecked substep in `S-01`.
2. Commit completed `S-01` substeps and attach command output/artifact evidence.
3. Continue `S-01` substeps sequentially until row status can move to `READY`.
4. Start `S-02` only after `S-01` reaches `READY` with complete evidence.
5. Keep customer-owned `B-TBD-*` items in backlog until customer input arrives.

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
