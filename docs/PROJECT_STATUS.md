# Project status

Last updated: 2026-02-12

## Goal

Deliver a customer-ready V1 as a hosted single-tenant service per customer.

## Active milestone

**M0: Scope and operating-contract lock** (see `docs/ROADMAP.md`).

## Current state

- KVA import + Talousarvio baseline decisions are locked.
- **Ennuste page** is functionally complete per `docs/PROJECTION_UX_PLAN.md`. **Ennuste UX betterment** sprint (5 steps from `docs/ENNUSTE_UX_AUDIT.md`) is now the active sprint: S-01 DriverPlanner layout, S-02 controls + create modal, S-03 verdict/table/diagram, S-04 RevenueReport + bottom, S-05 global + a11y + final pass (working UI with all 33 audit items addressed).

## Top blockers

1. None. Customer TBD items `B-TBD-01..B-TBD-05` remain open and non-blocking.

## Next 5 actions

1. DO: Execute first unchecked substep of S-01 (DriverPlanner grid and grouping).
2. Keep root gates green (`pnpm lint`, `pnpm typecheck`, `pnpm test`).
3. Backlog: B-615 DONE; B-616 in sprint (Ennuste UX betterment).
4. REVIEW will confirm working UI with every audit item addressed at end of S-05.
5. Customer TBDs: `B-TBD-01..B-TBD-05` remain open and non-blocking.

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
