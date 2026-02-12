# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- KVA import + Talousarvio baseline decisions are locked.
- Active sprint was rotated from Talousarvio tab view to **Ennuste page completion** (`S-01..S-05`) per `docs/PROJECTION_UX_PLAN.md`.
- All current sprint items are `TODO`.

## Top blockers

1. None. Customer TBD items `B-TBD-01..B-TBD-05` remain open and non-blocking.

## Next 5 actions

1. DO: Execute first unchecked substep of `S-01` (API/domain override schema + persistence).
2. Keep projection API and UI contracts aligned while introducing per-year and `% from year X` modes.
3. Keep root gates green (`pnpm lint`, `pnpm typecheck`, `pnpm test`).
4. Backlog tracking: `B-615` in sprint; `B-611` is a dependency and must be closed through Ennuste implementation.
5. Optional manual smoke after S-03/S-04: scenario select -> horizon -> inputs -> compute -> table/diagram consistency.

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
