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
- `S-01` has all 6 substeps checked, but evidence is still uncommitted/non-conforming and cannot be accepted.

## Top blockers

1. Working tree dirty: `apps/api/prisma/seed.ts`, `apps/api/src/demo/demo-bootstrap.service.ts`, multiple `S-01` API/web files, `docs/SPRINT.md`, `docs/WORKLOG.md`.
2. `S-01` evidence contradiction: substep-6 sprint evidence claims successful `pnpm test`, but DO worklog records substep-6 as blocked by failing test.
3. No sprint row is `READY`, so REVIEW cannot verify acceptance-to-`DONE`.

## Next 5 actions

1. Re-run `DO` on `S-01` substep 6 and resolve the `pnpm test` blocker recorded in worklog.
2. Replace each checked `S-01` substep evidence with required `commit/run/files` format.
3. Commit pending `S-01` changes so evidence no longer depends on uncommitted state.
4. Move `S-01` to `READY` only after evidence format and regression evidence are complete.
5. Start `S-02` only after `S-01` is `READY`.

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
